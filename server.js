const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mqtt = require('mqtt');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// =====================
// KONFIGURASI HIVEMQ
// =====================
const MQTT_HOST = '998e139067784069a4839a198d502e0f.s1.eu.hivemq.cloud';
const MQTT_PORT = 8883;
const MQTT_USERNAME = 'triosakti';
const MQTT_PASSWORD = 'Triosakti12345';
const MQTT_TOPIC = 'iot/sensor/dht';

// Simpan data terbaru
let latestData = {
  suhu: null,
  kelembaban: null,
  timestamp: null
};

// History untuk grafik (max 20 data)
let history = [];

// =====================
// KONEKSI MQTT
// =====================
const mqttClient = mqtt.connect(`mqtts://${MQTT_HOST}:${MQTT_PORT}`, {
  username: MQTT_USERNAME,
  password: MQTT_PASSWORD,
  rejectUnauthorized: false
});

mqttClient.on('connect', () => {
  console.log('✅ Terhubung ke HiveMQ Cloud');
  mqttClient.subscribe(MQTT_TOPIC, (err) => {
    if (!err) console.log(`📡 Subscribe ke topic: ${MQTT_TOPIC}`);
  });
});

mqttClient.on('message', (topic, message) => {
  try {
    const data = JSON.parse(message.toString());
    latestData = {
      suhu: data.suhu,
      kelembaban: data.kelembaban,
      timestamp: new Date().toLocaleTimeString('id-ID')
    };

    // Simpan ke history
    history.push({ ...latestData });
    if (history.length > 20) history.shift();

    console.log(`📊 Data diterima - Suhu: ${data.suhu}°C, Kelembaban: ${data.kelembaban}%`);

    // Kirim ke semua client dashboard via Socket.io
    io.emit('data-sensor', { latest: latestData, history });
  } catch (e) {
    console.error('❌ Error parse data:', e.message);
  }
});

mqttClient.on('error', (err) => {
  console.error('❌ MQTT Error:', err.message);
});

// =====================
// EXPRESS SERVER
// =====================
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/data', (req, res) => {
  res.json({ latest: latestData, history });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// =====================
// SOCKET.IO
// =====================
io.on('connection', (socket) => {
  console.log('🖥️  Dashboard terhubung');
  // Kirim data terbaru saat client connect
  socket.emit('data-sensor', { latest: latestData, history });
});

// =====================
// START SERVER
// =====================
const PORT = 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server berjalan di http://localhost:${PORT}`);
});
