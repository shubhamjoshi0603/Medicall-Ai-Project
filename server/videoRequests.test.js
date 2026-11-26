const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const register = require("./videoRequests");

test("video request, occupied slot, approval, repeat approval and decline", async t => {
  const routes = {};
  const router = Object.fromEntries(["get","post","patch"].map(method => [method,
    (path, guard, handler) => { routes[method+" "+path] = handler; }]));
  const id = () => String(new mongoose.Types.ObjectId());
  const patientId=id(), doctorId=id(), clinicId=id(), requestId=id();
  const doctor={name:"Sample doctor",specialization:"General medicine"};
  const patient={fullName:"Sample patient",email:"patient@example.invalid"};
  let request, appointment, sent=0;
  const Request = mongoose.model("VideoVisitRequest");
  t.mock.method(Request,"create",async values => {request={...values,_id:requestId,status:"Pending"};});
  const matches = filter => Object.entries(filter).every(([key,value])=>request?.[key]===value);
  t.mock.method(Request,"findOne",async filter=>matches(filter)?request:null);
  t.mock.method(Request,"updateOne",async (filter,update)=>{
    if(!matches(filter))return {modifiedCount:0};
    Object.assign(request,update.$set);return {modifiedCount:1};
  });
  t.mock.method(mongoose.connection,"transaction",async callback=>callback({}));
  register(router,{
    Doctor:{exists:async()=>true,findById:async()=>doctor},Patient:{findById:async()=>patient},
    Clinic:{findById:async()=>({clinicName:"Example clinic"})},
    Appointment:{create:async ([values])=>{appointment=values;return [values];}},
    slotsFor:async()=>["11:30"],withBookingReference:async(d,t,write)=>write("02113042"),
    sendAppointmentEmail:async details=>{assert.equal(details.to,patient.email);assert.equal(details.bookingReference,appointment.bookingReference);sent++;return true;}
  });
  async function call(route,body){
    const res={code:200,status(n){this.code=n;return this;},json(data){this.data=data;return this;}};
    await routes[route]({patientId,doctorId,clinicId,params:{id:requestId},body},res);return res.code;
  }
  const date="2099-01-02",create="post /api/patient/video-requests",review="patch /api/doctor/video-requests/:id";
  assert.equal(await call(create,{doctorId,clinicId,date,phone:"9999999999"}),201);
  assert.equal(await call(review,{date,time:"10:00",decision:"Approve"}),409);
  assert.equal(request.status,"Pending");assert.equal(sent,0);
  assert.equal(await call(review,{date,time:"11:30",decision:"Approve"}),200);
  assert.equal(request.status,"Approved");assert.equal(request.reference,appointment.bookingReference);
  assert.equal(appointment.clinicId,clinicId);assert.equal(appointment.doctorId,doctorId);
  assert.match(appointment.videoRoomId,/^MediCallAI-[a-f0-9]{40}$/);
  assert.equal(await call(review,{date,time:"11:30",decision:"Approve"}),409);assert.equal(sent,1);
  await call(create,{doctorId,clinicId,date,phone:"9999999999"});
  assert.equal(await call(review,{decision:"Decline"}),200);
  assert.equal(request.status,"Declined");assert.equal(sent,1);
});
