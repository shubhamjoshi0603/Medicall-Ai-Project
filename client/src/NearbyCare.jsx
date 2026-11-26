import { useEffect, useState } from "react";
import axios from "axios";

function distanceKm(origin, location) {
  if (!origin || !Number.isFinite(location?.latitude) || !Number.isFinite(location?.longitude)) return null;
  const rad = n => n * Math.PI / 180;
  const lat = rad(location.latitude - origin.latitude), lon = rad(location.longitude - origin.longitude);
  const a = Math.sin(lat/2)**2 + Math.cos(rad(origin.latitude))*Math.cos(rad(location.latitude))*Math.sin(lon/2)**2;
  return 12742 * Math.asin(Math.sqrt(Math.min(1,a)));
}

export default function NearbyCare({ apiUrl, token, onBook }) {
  const [clinics,setClinics] = useState(null);
  const [revision,setRevision] = useState(0);
  const [origin,setOrigin] = useState(null);
  const [query,setQuery] = useState("");
  const [specialty,setSpecialty] = useState("");
  const [radius,setRadius] = useState("");
  const [message,setMessage] = useState("");
  const [booking,setBooking] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    axios.get(apiUrl + "/patient/find-care",{signal:controller.signal,headers:{Authorization:"Bearer " + token}})
      .then(({data})=>setClinics(data)).catch(()=>{if(!controller.signal.aborted) setMessage("Could not load clinics. Try Refresh.");});
    return () => controller.abort();
  },[apiUrl,token,revision]);
  function locate() {
    if (!navigator.geolocation) { setMessage("Location unavailable. Search by area instead."); return; }
    setMessage("Finding your location…");
    navigator.geolocation.getCurrentPosition(({coords})=>{
      setOrigin({latitude:coords.latitude,longitude:coords.longitude}); setMessage("Sorted by straight-line distance.");
    },()=>setMessage("Location unavailable. You can still search by area, doctor or specialty."),{timeout:10000});
  }
  const term = query.trim().toLowerCase();
  const specialties = [...new Set((clinics || []).flatMap(c=>c.doctors.map(d=>d.specialization)).filter(Boolean))].sort();
  const matches = (clinics || []).map(c=>{
    const clinicMatches = [c.clinicName,c.location?.address].some(v=>v?.toLowerCase().includes(term));
    const doctors = c.doctors.filter(d=>(!specialty || d.specialization === specialty) &&
      (clinicMatches || [d.name,d.specialization].some(v=>v?.toLowerCase().includes(term))));
    return {...c,doctors,clinicMatches,distance:distanceKm(origin,c.location)};
  }).filter(c=>(c.doctors.length || (!specialty && c.clinicMatches)) &&
    (!radius || (c.distance !== null && c.distance <= Number(radius))))
    .sort((a,b)=>(a.distance ?? Infinity)-(b.distance ?? Infinity) || a.clinicName.localeCompare(b.clinicName));
  async function book(c,d) {
    setBooking(true);
    try { await onBook(c._id,d._id); }
    catch { setMessage("This doctor could not be selected. Refresh the results and try again."); }
    finally {setBooking(false);}
  }
  return <section className="workspace-panel lab-panel"><header><h2>Nearby clinics and specialists</h2>
    <button onClick={()=>{setMessage("");setRevision(v=>v+1);}}>Refresh</button></header>
    <p>Search clinics registered with MediCall and the specialists listed by each clinic.</p>
    <div className="lab-form"><label>Doctor, clinic or area<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search by name or locality" /></label>
    <label>Specialty<select value={specialty} onChange={e=>setSpecialty(e.target.value)}><option value="">All specialties</option>{specialties.map(s=><option key={s}>{s}</option>)}</select></label>
    <button onClick={locate}>Use my location</button>
    {origin && <label>Distance<select value={radius} onChange={e=>setRadius(e.target.value)}><option value="">Any distance</option>{[5,10,25,50].map(r=><option key={r} value={r}>Within {r} km</option>)}</select></label>}</div>
    <p role="status">{message}</p>
    {clinics === null && !message && <p>Loading clinics…</p>}
    {clinics && !matches.length && <p>No clinics match these filters. Try another specialty, area or distance.</p>}
    {matches.map(c=><article key={c._id} className="lab-request"><header><h3>{c.clinicName}</h3>
      {origin && <span>{c.distance === null ? "Distance unavailable" : c.distance.toFixed(1) + " km away"}</span>}</header>
      <p>{c.location?.address || "Address unavailable"}</p>
      {c.doctors.map(d=><div className="flex flex-wrap items-center justify-between gap-2 py-2" key={d._id}><div><strong>{d.name}</strong><p>{d.specialization} · ₹{d.fee}</p></div>
        <button disabled={booking} onClick={()=>book(c,d)}>Book with {d.name}</button></div>)}
      {!c.doctors.length && <p>No active doctors listed.</p>}</article>)}
  </section>;
}
