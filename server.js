require('dotenv').config();
const express = require('express');
const http = require('http');
const { Pool, Client } = require('pg');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: '*' } });

app.use(express.json());
app.use(cors());
app.use(express.static(__dirname));  
app.use(express.static('public'));    

const DATABASE_URL = process.env.DATABASE_URL || 'postgres://apt_user:apt_pass@localhost:5432/apt_assignment';
const pool = new Pool({ connectionString: DATABASE_URL });

app.get('/orders', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM orders ORDER BY updated_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching orders:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/orders', async (req, res) => {
  try {
    const { customer_name, product_name, status } = req.body;
    const result = await pool.query(
      'INSERT INTO orders (customer_name, product_name, status, updated_at) VALUES ($1,$2,$3,NOW()) RETURNING *',
      [customer_name, product_name, status || 'pending']
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error inserting order:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/orders/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { customer_name, product_name, status } = req.body;
    const result = await pool.query(
      `UPDATE orders SET 
         customer_name = COALESCE($1, customer_name),
         product_name = COALESCE($2, product_name),
         status = COALESCE($3, status),
         updated_at = NOW()
       WHERE id = $4 RETURNING *`,
      [customer_name, product_name, status, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating order:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/orders/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM orders WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ deleted: true, row: result.rows[0] });
  } catch (err) {
    console.error('Error deleting order:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const listenClient = new Client({ connectionString: DATABASE_URL });

(async () => {
  await listenClient.connect();
  await listenClient.query('LISTEN orders_changes');
  console.log('Listening for orders_changes notifications...');

  listenClient.on('notification', (msg) => {
    try {
      const payload = JSON.parse(msg.payload);
      console.log('DB notification:', payload);
      io.emit('order_update', payload);
    } catch (err) {
      console.error('Failed to parse notification payload', err);
    }
  });
})().catch(err => {
  console.error('Error setting up listener:', err);
});


io.on('connection', (socket) => {
  console.log('Client connected', socket.id);
  socket.on('disconnect', () => console.log('Client disconnected', socket.id));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
