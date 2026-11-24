import { useEffect, useState } from "react";
import axios from "axios";

function coordinates(location) {
  if (!Number.isFinite(location?.latitude) || !Number.isFinite(location?.longitude)) return null;
  return [location.latitude, location.longitude];
}
function distance(a, b) {
  const radians = n => n * Math.PI / 180;
  const h = Math.sin(radians(b[0]-a[0])/2)**2 + Math.cos(radians(a[0])) * Math.cos(radians(b[0])) * Math.sin(radians(b[1]-a[1])/2)**2;
  return 12742 * Math.asin(Math.sqrt(Math.min(h, 1)));
}
export default function ClinicDirectory({ apiUrl, onChoose }) {
  const [rows, setRows] = useState(null);
  const [search, setSearch] = useState("");
  const [here, setHere] = useState(null);
  const [map, setMap] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    axios.get(apiUrl + "/public/directory", { signal: controller.signal }).then(r => setRows(r.data)).catch(() => { if (!controller.signal.aborted) setError("Could not load the clinic directory."); });
    return () => controller.abort();
  }, [apiUrl]);
  const needle = search.toLowerCase().trim();
  const visible = (rows || []).filter(c => [c.clinicName,c.location?.address,...c.doctors.map(d => d.specialization + " " + d.name)].some(v => v?.toLowerCase().includes(needle)))
    .map(c => ({ ...c, km: here && coordinates(c.location) ? distance(here, coordinates(c.location)) : null }))
    .sort((a,b) => (a.km ?? Infinity) - (b.km ?? Infinity) || a.clinicName.localeCompare(b.clinicName));
  return <section className="workspace-panel"><header><h3>Clinic directory</h3><button onClick={() => {
    if (!navigator.geolocation) return setError("Location is unavailable in this browser.");
    navigator.geolocation.getCurrentPosition(p => { setHere([p.coords.latitude,p.coords.longitude]); setError(""); }, () => setError("Location unavailable. Search by clinic or specialty."), { timeout: 10000 });
  }}>Sort by distance</button></header>
    <label>Search by specialty, doctor or location<input type="search" value={search} onChange={e => setSearch(e.target.value)} /></label>
    {error && <p role="alert">{error}</p>}{rows && !visible.length && <p>No matching clinics.</p>}
    <ul>{visible.map(c => <li key={c._id}><div><strong>{c.clinicName}</strong><p>{c.location?.address}</p>
      <p>{[...new Set(c.doctors.map(d => d.specialization))].join(" · ")}</p><p>{c.rating ? c.rating.average.toFixed(1) + "/5 from " + c.rating.count + " reviews" : "No ratings yet"}{c.km != null && " · " + c.km.toFixed(1) + " km away"}</p>
      </div><footer><button onClick={() => onChoose(c._id)}>Select clinic</button>{coordinates(c.location) && <button onClick={() => setMap(c)}>View map</button>}</footer></li>)}</ul>
    {map && <div><h4>{map.clinicName}</h4><iframe title={map.clinicName + " map"} loading="lazy" referrerPolicy="no-referrer" src={"https://maps.google.com/maps?output=embed&q=" + coordinates(map.location).join(",")} />
      <a target="_blank" rel="noreferrer" href={"https://www.google.com/maps/dir/?api=1&destination=" + coordinates(map.location).join(",")}>Google Maps directions</a></div>}
  </section>;
}
