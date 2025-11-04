const express = require('express');
const app = express();
const router = express.Router();
const mysql = require('mysql2/promise');

// Configuración de la conexión
const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'n0m3l0', // tu contraseña de MySQL
    database: 'carrito'
});

let cart = [];

router.get('/', (req, res) => {
  res.json(cart);
});

router.post('/agregar', (req, res) => {
    const { id, nombre, precio, cantidad } = req.body;
    const productoExistente = cart.find(item => item.id === id);

    if (productoExistente) {
        productoExistente.cantidad += parseInt(cantidad);
    } else {
        cart.push({ 
            id, 
            nombre, 
            precio: parseFloat(precio), 
            cantidad: parseInt(cantidad) 
        });
        console.log('Producto agregado');
    }

    res.redirect('/');
});

router.delete('/eliminar/:id', (req, res) => {
  const id = req.params.id; // Remove parseInt
  cart = cart.filter(item => item.id !== id);
  res.json({ mensaje: 'Producto eliminado', carrito: cart });
});

router.get('/total', (req, res) => {
  const total = cart.reduce((sum, item) => sum + item.precio * item.cantidad, 0);
  const cantidadTotal = cart.reduce((sum, item) => sum + item.cantidad, 0);
  
  res.json({ 
    total: total,
    cantidadTotal: cantidadTotal,
    productos: cart 
  });
});

// Agregar nueva ruta para guardar en base de datos
router.post('/guardarEnBD', async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        console.log('Conectado a la base de datos');
        console.log('Productos a guardar:', cart);

        for (const producto of cart) {
            const [result] = await connection.execute(
                'INSERT INTO productos (id, nombre, precio, cantidad) VALUES (?, ?, ?, ?)',
                [
                    producto.id, 
                    producto.nombre,
                    parseFloat(producto.precio),
                    parseInt(producto.cantidad)
                ]
            );
            console.log('Producto guardado:', producto, 'Resultado:', result);
        }
        
        cart = []; // Limpiamos el carrito después de guardar
        res.json({ 
            success: true, 
            message: 'Productos guardados en la base de datos'
        });

    } catch (error) {
        console.error('Error detallado:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Error al guardar en la base de datos',
            details: error.message 
        });
    } finally {
        if (connection) {
            connection.release();
            console.log('Conexión liberada');
        }
    }
});

module.exports = router;