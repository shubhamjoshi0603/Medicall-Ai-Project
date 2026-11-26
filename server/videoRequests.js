const mongoose = require("mongoose");
const crypto = require("node:crypto");
const { validDay } = require("./scheduling");
const schema = new mongoose.Schema({
  patientId: {type: mongoose.Schema.Types.ObjectId, ref:"Patient", required:true},
  doctorId: {type: mongoose.Schema.Types.ObjectId, ref:"Doctor", required:true},
  clinicId: {type: mongoose.Schema.Types.ObjectId, required:true},
  date: String, phone:String, status:{type:String,default:"Pending"},
  bookedDate:String, time:String, reference:String
}, {timestamps:true});
schema.index({patientId:1,doctorId:1,date:1},{unique:true,partialFilterExpression:{status:"Pending"}});
const Request = mongoose.model("VideoVisitRequest", schema);

module.exports = function registerVideo(app,{Doctor,Clinic,Patient,Appointment,protectDoctor,protectPatient,slotsFor,withBookingReference,sendAppointmentEmail}) {
  for (const [role,guard] of [["patient",protectPatient],["doctor",protectDoctor]]) {
    app.get("/api/"+role+"/video-requests",guard,async(req,res)=>{
      const field=role+"Id";
      const rows=await Request.find({[field]:req[field]}).sort({createdAt:-1})
        .populate("doctorId","name").populate("patientId","fullName");
      res.set("Cache-Control","no-store").json(rows);
    });
  }
  app.post("/api/patient/video-requests",protectPatient,async(req,res)=>{
    const {clinicId,doctorId,date,phone}=req.body;
    if (!validDay(date) || date < new Date().toLocaleDateString("en-CA",{timeZone:"Asia/Kolkata"}) ||
        !mongoose.isObjectIdOrHexString(clinicId) || !mongoose.isObjectIdOrHexString(doctorId) ||
        typeof phone!=="string" || !/^\+?[\d ()-]{7,20}$/.test(phone) || phone.replace(/\D/g,"").length<7)
      return res.status(400).json({message:"Choose a doctor, a current or future date and a contact number."});
    if (!await Doctor.exists({_id:doctorId,clinicId,isActive:true})) return res.status(404).json({message:"Doctor unavailable."});
    try {await Request.create({patientId:req.patientId,doctorId,clinicId,date,phone});}
    catch(e){if(e.code===11000)return res.status(409).json({message:"You already have a pending request for this date."});throw e;}
    res.status(201).json({message:"Video visit requested. Your doctor will select an available slot."});
  });
  app.patch("/api/doctor/video-requests/:id",protectDoctor,async(req,res)=>{
    const filter={_id:req.params.id,doctorId:req.doctorId,clinicId:req.clinicId,status:"Pending"};
    if(!mongoose.isObjectIdOrHexString(filter._id)) return res.sendStatus(400);
    const {decision,date,time}=req.body;
    if(decision==="Decline"){
      const changed=await Request.updateOne(filter,{$set:{status:"Declined"}});
      return res.status(changed.modifiedCount?200:409).json({message:changed.modifiedCount?"Request declined.":"Request already reviewed."});
    }
    if(decision!=="Approve" || !(await slotsFor(req.clinicId,req.doctorId,date)).includes(time))
      return res.status(409).json({message:"Doctor unavailable at this time. Choose a free slot."});
    const request=await Request.findOne(filter);
    if(!request)return res.status(409).json({message:"Request already reviewed."});
    if(date<request.date)return res.status(400).json({message:"Choose the requested date or a later date."});
    const [patient,doctor,clinic]=await Promise.all([Patient.findById(request.patientId),Doctor.findById(req.doctorId),Clinic.findById(req.clinicId)]);
    if(!patient||!doctor||!clinic)return res.sendStatus(404);
    let appointment;
    try {
      await withBookingReference(date,time,bookingReference=>mongoose.connection.transaction(async session=>{
        const changed=await Request.updateOne(filter,{$set:{status:"Approved",bookedDate:date,time,reference:bookingReference}},{session});
        if(!changed.modifiedCount)throw Object.assign(new Error("Request already reviewed."),{status:409});
        [appointment]=await Appointment.create([{bookingReference,clinicId:req.clinicId,doctorId:req.doctorId,patientName:patient.fullName,patientEmail:patient.email,phone:request.phone,date,time,reason:"Video consultation",videoRoomId:"MediCallAI-"+crypto.randomBytes(20).toString("hex")}],{session});
      }));
    } catch(e){if(e.status===409||e.code===11000)return res.status(409).json({message:"Request already processed or slot taken. Refresh and choose an available slot."});throw e;}
    const sent=await sendAppointmentEmail({to:patient.email,patientName:patient.fullName,clinicName:clinic.clinicName,clinicPhone:clinic.phone,doctorName:doctor.name,specialty:doctor.specialization,location:{address:"Video visit — open Appointments in your patient portal to join."},date,time,bookingReference:appointment.bookingReference}).catch(()=>false);
    res.json({message:sent?"Appointment booked and confirmation emailed.":"Appointment booked. Confirmation email could not be sent."});
  });
};
