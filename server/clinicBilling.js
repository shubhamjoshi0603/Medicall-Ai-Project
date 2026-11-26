const mongoose = require("mongoose");
const DAY = 86400000;
const Billing = mongoose.model("ClinicBilling", new mongoose.Schema({
  _id: mongoose.Schema.Types.ObjectId, trialUntil: Date, paidUntil: Date,
  orderId: String, amount: Number, lastPayment: String
}));

function currentPlan(account, now = Date.now()) {
  if (account?.paidUntil > now) return { plan: "Pro", until: account.paidUntil };
  if (account?.trialUntil > now) return { plan: "Trial", until: account.trialUntil };
  return { plan: "Free", until: null };
}
function planPrice() {
  const value = Number(process.env.CLINIC_PRO_PRICE_INR || (process.env.RAZORPAY_KEY_ID?.startsWith("rzp_live_") ? 0 : 499));
  return Number.isSafeInteger(value) && value > 0 && value <= 100000 ? value : null;
}
async function gateway(path, options = {}) {
  const auth = Buffer.from(process.env.RAZORPAY_KEY_ID + ":" + process.env.RAZORPAY_KEY_SECRET).toString("base64");
  const reply = await fetch("https://api.razorpay.com/v1/" + path, { ...options, headers: { Authorization: "Basic " + auth, "Content-Type": "application/json" }, signal: AbortSignal.timeout(12000) });
  if (!reply.ok) throw new Error("Payment provider unavailable");
  return reply.json();
}
module.exports = function registerBilling(app, protect, Appointment, { Clinic, sendEmail } = {}) {
  const base = "/api/clinic/billing";
  app.get(base, protect, async (req,res) => {
    const account = await Billing.findById(req.clinicId);
    res.set("Cache-Control","no-store").json({ ...currentPlan(account), trialUsed: Boolean(account?.trialUntil), price: planPrice(), pending: Boolean(account?.orderId) });
  });
  app.post(base+"/trial", protect, async (req,res) => {
    await Billing.updateOne({_id:req.clinicId},{$setOnInsert:{_id:req.clinicId}},{upsert:true});
    const set = await Billing.updateOne({_id:req.clinicId,trialUntil:null,$or:[{paidUntil:null},{paidUntil:{$lte:new Date()}}]},{$set:{trialUntil:new Date(Date.now()+14*DAY)}});
    if (set.modifiedCount && Clinic && sendEmail) {
      try {
        const [clinic, account] = await Promise.all([Clinic.findById(req.clinicId).select("clinicName email").lean(), Billing.findById(req.clinicId).lean()]);
        if (clinic?.email) await sendEmail({ to: clinic.email, clinicName: clinic.clinicName, plan: "Clinic Pro trial", validUntil: account?.trialUntil, price: 0 });
      } catch (error) { console.error("Clinic trial email failed:", error.message); }
    }
    res.status(set.modifiedCount?200:409).json({message:set.modifiedCount?"Your 14-day Pro trial has started.":"This trial is unavailable."});
  });
  app.post(base+"/order", protect, async (req,res) => {
    const price=planPrice();
    if (!price || !process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) return res.status(503).json({message:"Clinic plan checkout has not been configured."});
    let account=await Billing.findOneAndUpdate({_id:req.clinicId},{$setOnInsert:{_id:req.clinicId}},{upsert:true,new:true});
    if(currentPlan(account).plan==="Pro") return res.status(409).json({message:"Your paid plan is already active."});
    if(!account.orderId){
      try {
        const order=await gateway("orders",{method:"POST",body:JSON.stringify({amount:price*100,currency:"INR",notes:{clinicId:req.clinicId,purpose:"clinic-plan"}})});
        account=await Billing.findOneAndUpdate({_id:req.clinicId,orderId:null,$or:[{paidUntil:null},{paidUntil:{$lte:new Date()}}]},{$set:{orderId:order.id,amount:price*100}},{new:true}) || await Billing.findById(req.clinicId);
      }catch{return res.status(502).json({message:"Could not open clinic checkout. Please retry."});}
    }
    if(!account.orderId)return res.status(409).json({message:"Refresh to see your current plan."});
    res.json({key:process.env.RAZORPAY_KEY_ID,order_id:account.orderId,amount:account.amount,currency:"INR"});
  });
  app.post(base+"/confirm", protect, async (req,res) => {
    const account=await Billing.findById(req.clinicId);
    if(!account?.orderId)return res.status(currentPlan(account).plan==="Pro"?200:409).json({message:"Check your current plan."});
    let payments;
    try {payments=await gateway("orders/"+encodeURIComponent(account.orderId)+"/payments");}
    catch{return res.status(502).json({message:"Could not check your payment. Try Check payment again."});}
    const paid=payments.items?.find(p=>p.order_id===account.orderId && p.status==="captured" && p.amount===account.amount && p.currency==="INR" && !p.amount_refunded);
    if(!paid)return res.status(409).json({message:"Payment has not been captured yet. Check again after checkout."});
    const until=new Date(Math.max(Date.now(),Number(account.trialUntil)||0)+30*DAY);
    await Billing.updateOne({_id:req.clinicId,orderId:account.orderId},{$set:{paidUntil:until,lastPayment:paid.id},$unset:{orderId:1,amount:1}});
    if (Clinic && sendEmail) {
      try {
        const clinic = await Clinic.findById(req.clinicId).select("clinicName email").lean();
        if (clinic?.email) await sendEmail({ to: clinic.email, clinicName: clinic.clinicName, plan: "Clinic Pro", validUntil: until, price: Number(account.amount || 0) / 100 });
      } catch (error) { console.error("Clinic subscription email failed:", error.message); }
    }
    res.json({message:"Clinic Pro activated."});
  });
  app.get(base+"/monthly-summary",protect,async(req,res)=>{
    if(currentPlan(await Billing.findById(req.clinicId)).plan==="Free") return res.status(403).json({message:"Activate the trial or Pro plan to export."});
    const rows=await Appointment.aggregate([{$match:{clinicId:new mongoose.Types.ObjectId(req.clinicId)}},{$group:{_id:{$substrBytes:["$date",0,7]},visits:{$sum:1},completed:{$sum:{$cond:[{$eq:["$status","Completed"]},1,0]}},collected:{$sum:{$cond:[{$eq:["$paymentStatus","Paid"]},"$paymentAmount",0]}}}},{$sort:{_id:-1}}]);
    res.attachment("clinic-monthly-summary.csv").send(["Month,Appointments,Completed,Collected INR",...rows.map(r=>[r._id,r.visits,r.completed,r.collected].join(","))].join("\r\n"));
  });
};
module.exports.currentPlan=currentPlan;
