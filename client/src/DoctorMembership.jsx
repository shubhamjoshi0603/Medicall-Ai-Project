import {useState,useEffect} from "react";
import axios from "axios";

export function EmailCode({api,role,email,value,onChange}) {
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  async function send() {
    setBusy(true);
    try {const {data}=await axios.post(api+"/signup/email-code",{role,email});setMessage(data.message);}
    catch(e){setMessage(e.response?.data?.message || "Could not send the verification code.");}
    finally{setBusy(false);}
  }
  return <div className="membership-fields"><button type="button" disabled={busy || !email} onClick={send}>{busy?"Sending…":"Send verification OTP"}</button>
    <label>6-digit OTP from your inbox<input required type="text" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" value={value} onChange={e=>onChange(e.target.value)} /></label><small role="status">{message}</small></div>;
}
export function ProfileFields({profile}) {
  return <div className="membership-fields"><label>Doctor name<input required name="name" defaultValue={profile?.name}/></label>
    <label>Specialty<input required name="specialization" defaultValue={profile?.specialization}/></label>
    <label>Visit fee (₹)<input type="number" required min="0" step="0.01" name="fee" defaultValue={profile?.fee}/></label></div>;
}
export function EditDoctor({profile,save,api,clinicAdmin=false}) {
  const [open,setOpen]=useState(false), [error,setError]=useState("");
  const [newEmail,setNewEmail]=useState(""), [emailCode,setEmailCode]=useState("");
  const [currentEmailCode,setCurrentEmailCode]=useState("");
  return open ? <form className="membership-fields" onSubmit={async e=>{e.preventDefault();const fields=Object.fromEntries(new FormData(e.currentTarget));try{await save({...fields,newEmail,emailCode,currentEmailCode});setNewEmail("");setEmailCode("");setOpen(false);setError("");}catch(err){setError(err.response?.data?.message || "Could not update profile.");}}}>
    <ProfileFields profile={profile}/>{profile.email && <label>Sign-in email<input type="email" placeholder={profile.email} value={newEmail} onChange={e=>{setNewEmail(e.target.value);setEmailCode("");}}/></label>}{newEmail && clinicAdmin && <fieldset><legend>Approval from current mailbox ({profile.email})</legend><EmailCode api={api} role="doctor" email={profile.email} value={currentEmailCode} onChange={setCurrentEmailCode}/></fieldset>}{newEmail && <EmailCode api={api} role="doctor" email={newEmail} value={emailCode} onChange={setEmailCode}/>}<button>Save changes</button><button type="button" onClick={()=>setOpen(false)}>Cancel</button><small role="alert">{error}</small></form> :
    <button type="button" className="membership-action" onClick={()=>setOpen(true)}>Edit doctor profile</button>;
}
export function JoinClinic({api,token,doctor,refresh,logout}) {
  const [clinics,setClinics]=useState([]),[feedback,setFeedback]=useState("");
  useEffect(()=>{axios.get(api+"/public/clinics").then(r=>setClinics(r.data.clinics)).catch(()=>setFeedback("Could not load clinics."));},[api]);
  const config={headers:{Authorization:"Bearer "+token}};
  return <main className="membership-panel"><h1>{doctor.name}</h1><p>{doctor.email} · {doctor.specialization} · ₹{doctor.fee} per visit</p>
    <EditDoctor api={api} profile={doctor} save={async fields=>{await axios.patch(api+"/doctor/profile",fields,config);await refresh();}}/>
    <h2>Clinic membership</h2>{doctor.requestedClinic?<p>Awaiting approval from {clinics.find(c=>c._id===doctor.requestedClinic)?.clinicName || "your selected clinic"}.</p>:
    <form className="membership-fields" onSubmit={async e=>{e.preventDefault();const clinicId=new FormData(e.currentTarget).get("clinicId");try{await axios.post(api+"/doctor/clinic-request",{clinicId},config);await refresh();}catch(err){setFeedback(err.response?.data?.message || "Could not send request.");}}}>
    <label>Registered clinic<select name="clinicId" defaultValue="" required><option value="">Choose a clinic</option>{clinics.map(c=><option key={c._id} value={c._id}>{c.clinicName}</option>)}</select></label><button>Request to join clinic</button></form>}
    <button className="membership-action" onClick={()=>refresh().catch(()=>setFeedback("Could not refresh status."))}>Refresh status</button> <button onClick={logout}>Log out</button><p role="status">{feedback}</p></main>;
}
export function TeamRequests({api,refreshTeam}) {
  const [rows,setRows]=useState([]),[message,setMessage]=useState("");
  async function load(){try{setRows((await api.get("/team/requests")).data);}catch{setMessage("Could not load team requests.");}}
  useEffect(()=>{load();},[]);
  async function decide(id,decision){try{const {data}=await api.post("/team/requests/"+id,{decision});setMessage(data.message);await load();await refreshTeam();}catch(e){setMessage(e.response?.data?.message || "Could not update request.");}}
  return <section className="membership-panel"><h2>Doctor join requests</h2><button onClick={load}>Refresh requests</button>{!rows.length && <p>No pending requests.</p>}{rows.map(d=><article key={d._id}><strong>{d.name}</strong><p>{d.email} · {d.specialization} · ₹{d.fee}</p><button className="membership-action" onClick={()=>decide(d._id,"approve")}>Approve</button> <button onClick={()=>decide(d._id,"decline")}>Decline</button></article>)}<p role="status">{message}</p></section>;
}
