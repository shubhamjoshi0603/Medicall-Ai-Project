import { useEffect, useState } from "react";
import axios from "axios";

export function TimeOff({api, token, appointments, today}) {
  const [blocks,setBlocks] = useState([]);
  const [date,setDate] = useState(today);
  const [partial,setPartial] = useState(false);
  const [message,setMessage] = useState("");
  const [busy,setBusy] = useState(false);
  const url = api + "/doctor/time-off";
  useEffect(() => {
    const controller = new AbortController();
    axios.get(url,{headers:{Authorization:"Bearer "+token},signal:controller.signal})
      .then(r=>setBlocks(r.data)).catch(e=>{if (!axios.isCancel(e)) setMessage("Could not load time off.");});
    return () => controller.abort();
  },[token,url]);
  async function update(event,id) {
    event.preventDefault();
    const config = {headers:{Authorization:"Bearer "+token}};
    setBusy(true);
    try {
      if (id) {
        await axios.delete(url+"/"+id,config);
        setBlocks(current=>current.filter(b=>b._id!==id));
      } else {
        const fields = Object.fromEntries(new FormData(event.currentTarget));
        const {data} = await axios.post(url,fields,config);
        setBlocks(current=>[...current.filter(b=>b._id!==data._id),data]);
      }
      setMessage(id ? "Time off removed." : "Time off saved. Existing bookings are preserved.");
    } catch(e) {setMessage(e.response?.data?.message || "Could not update time off.");}
    finally {setBusy(false);}
  }
  const visits = appointments.filter(a=>a.date===date && a.status==="Confirmed");
  return <section className="doctor-profile-card mb-6"><h2>Date-specific time off</h2>
    <form className="membership-fields" onSubmit={update}>
      <label>Date<input type="date" name="date" required min={today} value={date} onChange={e=>setDate(e.target.value)}/></label>
      <label><select aria-label="Time off duration" value={partial?"partial":"full"} onChange={e=>setPartial(e.target.value==="partial")}><option value="full">Full day</option><option value="partial">Part of the day</option></select></label>
      {partial && <><label>From<input type="time" name="startTime" required/></label><label>Until<input type="time" name="endTime" required/></label></>}
      <button disabled={busy}>Block new bookings</button>
    </form>
    <h3>Confirmed visits on the selected date</h3>
    {visits.length ? visits.map(v=><p key={v._id}>{v.time} · {v.patientName}</p>) : <p>No confirmed visits.</p>}
    {blocks.filter(b=>b.from>=today).map(b=><div key={b._id} className="doctor-file-row"><span>{b.from} · {b.startTime ? b.startTime+"–"+b.endTime : "Full day"}</span><button disabled={busy} onClick={e=>update(e,b._id)}>Remove</button></div>)}
    <p role="status">{message}</p></section>;
}

export function FollowUps({api,token,today,appointments,openFile}) {
  const [notes,setNotes] = useState(null);
  const [error,setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    axios.get(api+"/doctor/follow-ups",{headers:{Authorization:"Bearer "+token},signal:controller.signal})
      .then(r=>setNotes(r.data)).catch(e=>{if(!axios.isCancel(e)) setError("Could not load follow-ups.");});
    return ()=>controller.abort();
  },[api,token]);
  if (!notes) return <p role="status">{error || "Loading follow-ups…"}</p>;
  const visits = new Map(appointments.map(a=>[a._id,a]));
  return <div className="doctor-settings-stack">{["Today","Overdue","Upcoming"].map(group=>{
    const items = notes.filter(n=>visits.has(n.appointmentId) && (n.followUpDate===today?"Today":n.followUpDate<today?"Overdue":"Upcoming")===group);
    return <section key={group} className="doctor-profile-card"><h2>{group}</h2>{items.length ? items.map(n=><button className="doctor-file-row" key={n._id} onClick={()=>openFile(visits.get(n.appointmentId))}><strong>{visits.get(n.appointmentId).patientName}</strong><span>{n.followUpDate} · Open file</span></button>) : <p>No follow-ups in this group.</p>}</section>;
  })}</div>;
}
