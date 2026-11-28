const test = require("node:test");
const assert = require("node:assert/strict");
const { slotTimes, validDay } = require("./scheduling");
const { extractRows } = require("./reportReader");
const app = require("./server");

test("lab comparison uses only explicit ranges printed with the value", () => {
  const text = ["Example A 9 mg/dL 10-20","Example B 10 mg/dL 10–20","Example C 21 mg/dL 10-20",
    "Example D pending","Example E 5 mg/dL 20-10","Example F <5 mg/dL 1-8"].join("\n");
  assert.deepEqual(extractRows(text).map(r => r.flag), ["Below", "Within", "Above"]);
});
test("booking windows use approved shifts, clinic hours and occupied slots", () => {
  const day = "2030-01-07", now = new Date(day + "T09:05:00+05:30");
  const hours = { isOpen: true, openTime: "09:00", closeTime: "10:00" };
  const shifts = [{ dayOfWeek: 1, startTime: "09:00", endTime: "11:00", slotMinutes: 15 }];
  assert.deepEqual(slotTimes(hours, shifts, ["09:30"], day, now), ["09:15","09:45"]);
  assert.deepEqual(slotTimes(hours, [], [], day, now), []);
  assert.deepEqual(slotTimes(hours, shifts, [], "2030-01-08", now), []);
  assert.deepEqual(slotTimes({ ...hours, isOpen:false }, [], [], day, now), []);
  assert.equal(validDay("2030-02-30"), false);
});
test("every protected route rejects a missing session before touching MongoDB", async t => {
  const http = app.listen(0, "127.0.0.1");
  await new Promise(resolve => http.once("listening",resolve));
  t.after(() => new Promise(resolve => http.close(resolve)));
  const base = "http://127.0.0.1:" + http.address().port;
  let checked = 0;
  for (const layer of app.router.stack) {
    const route = layer.route;
    if (!route || !route.stack.some(h => ["protect","protectDoctor","protectPatient"].includes(h.name))) continue;
    const method = Object.keys(route.methods)[0].toUpperCase();
    const response = await fetch(base + route.path.replace(/:\w+/g,"000000000000000000000001"), { method });
    assert.equal(response.status, 401, method + " " + route.path);
    await response.text(); checked++;
  }
  assert.ok(checked > 60, "Expected coverage across all three portals");
  assert.equal((await fetch(base + "/api/health")).status, 200);
});

test("time off blocks intersecting slots and preserves adjacent slots and weekly hours", () => {
  const {slotTimes} = require("./scheduling");
  const hours = {isOpen:true, openTime:"09:00", closeTime:"11:00"};
  const shifts = [{dayOfWeek:1,startTime:"09:00",endTime:"11:00",slotMinutes:30}];
  const slots = blocks => slotTimes(hours,shifts,[],"2030-01-07",new Date("2029-01-01"),blocks);
  assert.deepEqual(slots([{startTime:"09:45",endTime:"10:30"}]),["09:00","10:30"]);
  assert.deepEqual(slots([{}]),[]);
  assert.equal(slots([]).length,4);
});
