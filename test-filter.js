const axios = require('axios');
async function test() {
  try {
    const r1 = await axios.get('http://localhost:5000/api/bot/produccion-stats?categorias=', { headers: { Authorization: "Bearer mock" }});
    console.log("Without filter:", r1.data.stats.totalOrders);
    
    const r2 = await axios.get('http://localhost:5000/api/bot/produccion-stats?categorias=Altas/Inst', { headers: { Authorization: "Bearer mock" }});
    console.log("With filter Altas:", r2.data.stats.totalOrders);

    const r3 = await axios.get('http://localhost:5000/api/bot/produccion-stats?categorias=Reparaciones', { headers: { Authorization: "Bearer mock" }});
    console.log("With filter Reps:", r3.data.stats.totalOrders);
  } catch (e) { console.error(e.response ? e.response.status : e.message); }
}
test();
