const test = require("node:test");
const assert = require("node:assert/strict");
const mount = require("./doctorMembership");
const {verifySignup} = require("./signupVerification");
function response(){
  return {statusCode:200,status(n){this.statusCode=n;return this;},json(data){this.data=data;return this;}};
}
test("unverified registrations stop before creating any role", async()=>{
  for(const role of ["patient","clinic","doctor"]){
    const res=response();
    await verifySignup(role)({body:{email:"doctor@example.org"},path:"/register"},res,()=>assert.fail("Registration continued"));
    assert.equal(res.statusCode,400);
  }
});
test("only the requested clinic can approve a doctor, exactly once",async()=>{
  const id="604000000000000000000001", clinic="604000000000000000000002";
  const doctor={_id:id,clinicId:null,requestedClinic:clinic};
  const routes={};
  const record=(path,...handlers)=>{routes[path]=handlers.at(-1);};
  const Doctor={async updateOne(query,update){
    if(!Object.entries(query).every(([k,v])=>doctor[k]===v))return {modifiedCount:0};
    Object.assign(doctor,update.$set);return {modifiedCount:1};
  }};
  mount({app:{get:record,patch:record,post:record},Doctor,verifySignup:()=>()=>{}});
  for(const [actor,status] of [["604000000000000000000003",409],[clinic,200],[clinic,409]]){
    const res=response();
    await routes["/api/team/requests/:id"]({params:{id},body:{decision:"approve"},clinicId:actor},res);
    assert.equal(res.statusCode,status);
  }
  assert.equal(doctor.clinicId,clinic);
  assert.equal(doctor.requestedClinic,null);
});

test("issued email OTP expires, stops after five wrong guesses and works once", async t => {
  const mongoose = require("mongoose");
  const {setupVerification,consumeCode} = require("./signupVerification");
  const model = mongoose.model("SignupChallenge");
  const previous = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "local-test-key";
  t.after(() => { if (previous === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previous; });
  let item, issue, code;
  t.mock.method(model,"findOneAndUpdate",async (filter,update) => {item={_id:filter._id,...update.$set};});
  const active = filter => item && item._id === filter._id && item.expiresAt > filter.expiresAt.$gt && item.attempts < filter.attempts.$lt;
  t.mock.method(model,"findOneAndDelete",async filter => {
    if (!active(filter) || item.digest !== filter.digest) return null;
    const consumed=item; item=null; return consumed;
  });
  t.mock.method(model,"updateOne",async (filter,update) => {
    if(active(filter) && item.digest !== filter.digest.$ne) item.attempts += update.$inc.attempts;
  });
  setupVerification({post(path,handler){issue=handler;}},async mail=>{
    code=mail.text.match(/\b\d{6}\b/)[0]; return true;
  });
  const email="doctor@example.org";
  const send=()=>issue({body:{role:"doctor",email}},response());
  await send();
  assert.equal(await consumeCode("patient",email,code),false);
  assert.equal(await consumeCode("doctor","other@example.org",code),false);
  const wrong=code==="000000"?"000001":"000000";
  for(let i=0;i<5;i++) assert.equal(await consumeCode("doctor",email,wrong),false);
  assert.equal(await consumeCode("doctor",email,code),false);
  await send(); item.expiresAt=new Date(0);
  assert.equal(await consumeCode("doctor",email,code),false);
  await send();
  assert.equal(await consumeCode("doctor",email,code),true);
  assert.equal(await consumeCode("doctor",email,code),false);
});
