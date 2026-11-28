import {useEffect,useState} from "react";
import axios from "axios";
import {SlotOptions} from "./SchedulingTools.jsx";

function Decision({row,apiUrl,save,busy}) {
  const [date,setDate]=useState(row.date);
  const [time,setTime]=useState("");
  return <form onSubmit={e=>{e.preventDefault();save(row._id,{decision:"Approve",date,time});}}>
    <label>Video visit date<input type="date" required min={row.date} value={date} onChange={e=>{setDate(e.target.value);setTime("");}}/></label>
    <label>Available time (IST)<select required value={time} onChange={e=>setTime(e.target.value)}><SlotOptions apiUrl={apiUrl} clinicId={row.clinicId} doctorId={row.doctorId?._id} date={date}/></select></label>
    <button disabled={busy || !time}>Approve and book</button>
    <button type="button" disabled={busy} onClick={()=>save(row._id,{decision:"Decline"})}>Decline</button>
  </form>;
}

export default function VideoRequests({role,apiUrl,token,clinicId,doctorId,date,phone,onBooked}) {
  const [rows,setRows]=useState([]);
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  const [revision,setRevision]=useState(0);
  const url=apiUrl+"/"+role+"/video-requests";
  useEffect(()=>{
    const controller=new AbortController();
    axios.get(url,{headers:{Authorization:"Bearer "+token},signal:controller.signal}).then(({data})=>setRows(data)).catch(()=>{if(!controller.signal.aborted)setMessage("Could not load video requests. Refresh to retry.");});
    return ()=>controller.abort();
  },[url,token,revision]);
  async function save(id,body){
    setBusy(true);
    try {
      const {data}=await axios({url:id?url+"/"+id:url,method:id?"patch":"post",headers:{Authorization:"Bearer "+token},data:body});
      setMessage(data.message);setRevision(v=>v+1);
      if(body.decision==="Approve") {
        try { await onBooked?.(); } catch { setMessage(data.message + " Refresh the appointment list to see it."); }
      }
    }catch(e){setMessage(e.response?.data?.message || "Could not complete this action. Refresh to check the request.");}
    finally{setBusy(false);}
  }
  return <section className="workspace-panel"><header><h3>Video visit requests</h3><button type="button" onClick={()=>setRevision(v=>v+1)}>Refresh</button></header>
    {role==="patient" && <><p>If your preferred time is taken, request a video visit. Your doctor can confirm a free slot on your chosen date or later.</p>
    <button type="button" disabled={busy || !clinicId || !doctorId || !date || !phone} onClick={()=>save(null,{clinicId,doctorId,date,phone})}>Request video visit</button></>}
    <p role="status">{message}</p>
    {rows.map(row=><article key={row._id}><strong>{role==="patient"?row.doctorId?.name:row.patientId?.fullName}</strong><p>{row.status} · {row.bookedDate || row.date} {row.time} {row.reference && " · Booking "+row.reference}</p>
    {role==="doctor" && row.status==="Pending" && <Decision row={row} apiUrl={apiUrl} busy={busy} save={save}/>}</article>)}
  </section>;
}
