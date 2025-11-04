require('dotenv').config()
const express = require('express');
const session = require('express-session')
const MySQLStore = require('express-mysql-session')(session)
const mysql = require('mysql2/promise')
const path = require('path')
const bcrypt = require('bcrypt')

const app = express()
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE
})

const sessionStore = new MySQLStore({}, pool)

app.use(session({
  key: 'sid',
  secret: process.env.SESSION_SECRET,
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24,
    httpOnly: true,
    secure: false,
    sameSite: 'lax'
  }
}))

// Middleware: requiere autenticación
function requireAuth(req, res, next) {
  if (req.session && req.session.userId) {
    return next()
  }
  res.redirect('/')
}

// Middleware: requiere ser admin
function requireAdmin(req, res, next) {
  if (req.session && req.session.userId && req.session.isAdmin) {
    return next()
  }
  res.status(403).send(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>Acceso Denegado</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100vh;
          margin: 0;
          background: #f5f5f5;
        }
        .error-box {
          background: white;
          padding: 40px;
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          text-align: center;
        }
        h1 { color: #dc2626; margin-bottom: 10px; }
        p { color: #666; margin-bottom: 20px; }
        a {
          display: inline-block;
          padding: 10px 20px;
          background: #292524;
          color: white;
          text-decoration: none;
          border-radius: 5px;
        }
      </style>
    </head>
    <body>
      <div class="error-box">
        <h1>⛔ Acceso Denegado</h1>
        <p>No tienes permisos de administrador para acceder a esta página.</p>
        <a href="/">Volver al inicio</a>
      </div>
    </body>
    </html>
  `)
}

// Ruta principal (landing page pública)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'))
})

// RUTA PROTEGIDA: index2.html solo para admins
app.get('/index2.html', requireAuth, requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index2.html'))
})

// Servir archivos estáticos
app.use(express.static('public'))

// GET: Obtener todos los productos (PÚBLICO)
app.get('/api/productos', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, nombre, descripcion, precio, cantidad, imagen_url FROM pan ORDER BY id'
    )
    res.json(rows)
  } catch (error) {
    console.error('Error al obtener productos:', error)
    res.status(500).json({ error: 'Error al obtener productos' })
  }
})

// POST: Agregar producto (SOLO ADMIN)
app.post('/api/productos', async (req, res) => {
  try {
    if (!req.session.userId || !req.session.isAdmin) {
      return res.status(403).json({ error: 'No tienes permisos de administrador' })
    }

    const { nombre, descripcion, precio, cantidad, imagen_url } = req.body
    
    if (!nombre || !precio || cantidad === undefined) {
      return res.status(400).json({ error: 'Nombre, precio y cantidad son requeridos' })
    }
    
    const [result] = await pool.query(
      'INSERT INTO pan (nombre, descripcion, precio, cantidad, imagen_url) VALUES (?, ?, ?, ?, ?)',
      [nombre, descripcion || null, parseFloat(precio), parseInt(cantidad), imagen_url || null]
    )
    
    res.json({ success: true, mensaje: 'Pan agregado correctamente', id: result.insertId })
  } catch (error) {
    console.error('Error al insertar producto:', error)
    res.status(500).json({ error: 'Error al agregar el producto' })
  }
})

// PUT: Actualizar producto (SOLO ADMIN)
app.put('/api/productos/:id', async (req, res) => {
  try {
    if (!req.session.userId || !req.session.isAdmin) {
      return res.status(403).json({ error: 'No tienes permisos de administrador' })
    }

    const { id } = req.params
    const { nombre, descripcion, precio, cantidad, imagen_url } = req.body
    
    await pool.query(
      'UPDATE pan SET nombre = ?, descripcion = ?, precio = ?, cantidad = ?, imagen_url = ? WHERE id = ?',
      [nombre, descripcion || null, parseFloat(precio), parseInt(cantidad), imagen_url || null, id]
    )
    
    res.json({ success: true, mensaje: 'Producto actualizado correctamente' })
    
  } catch (error) {
    console.error('Error al actualizar producto:', error)
    res.status(500).json({ error: 'Error al actualizar el producto' })
  }
})

// DELETE: Eliminar producto (SOLO ADMIN)
app.delete('/api/productos/:id', async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Debes iniciar sesión' })
    }
    
    if (!req.session.isAdmin) {
      return res.status(403).json({ error: 'No tienes permisos de administrador' })
    }

    const { id } = req.params
    
    const [producto] = await pool.query('SELECT * FROM pan WHERE id = ?', [id])
    
    if (producto.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' })
    }
    
    await pool.query('DELETE FROM pan WHERE id = ?', [id])
    
    console.log(`[ADMIN: ${req.session.username}] Eliminó producto ID: ${id} - ${producto[0].nombre}`)
    
    res.json({ 
      success: true, 
      mensaje: 'Producto eliminado correctamente'
    })
    
  } catch (error) {
    console.error('Error al eliminar producto:', error)
    res.status(500).json({ error: 'Error al eliminar el producto' })
  }
})

// Endpoint para guardar carrito en base de datos
app.post('/api/carrito/guardar', async (req, res) => {
  let connection;
  try {
    const { productos } = req.body
    
    if (!productos || productos.length === 0) {
      return res.status(400).json({ error: 'El carrito está vacío' })
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    for (const producto of productos) {
      const [stockCheck] = await connection.query(
        'SELECT cantidad FROM pan WHERE id = ?',
        [producto.id]
      );

      if (stockCheck.length === 0) {
        throw new Error(`Producto con ID ${producto.id} no encontrado`);
      }

      const cantidadDisponible = stockCheck[0].cantidad;

      if (cantidadDisponible < producto.cantidad) {
        throw new Error(`Stock insuficiente para ${producto.nombre}. Disponible: ${cantidadDisponible}, Solicitado: ${producto.cantidad}`);
      }

      await connection.query(
        'INSERT INTO pedidos (nombre, precio, cantidad) VALUES (?, ?, ?)',
        [
          producto.nombre,
          parseFloat(producto.precio),
          parseInt(producto.cantidad)
        ]
      );

      await connection.query(
        'UPDATE pan SET cantidad = cantidad - ? WHERE id = ?',
        [parseInt(producto.cantidad), producto.id]
      );
    }

    await connection.commit();
    console.log(`[PEDIDO] Se guardó pedido con ${productos.length} productos y se actualizó el stock`);

    res.json({
      success: true,
      mensaje: 'Pedido guardado correctamente y stock actualizado'
    })

  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error('Error al guardar carrito:', error);
    res.status(500).json({ 
      error: error.message || 'Error al guardar el pedido' 
    })
  } finally {
    if (connection) {
      connection.release();
    }
  }
})

// Endpoint para registro de nuevos usuarios (UNIFICADO - ELIMINÉ LA DUPLICACIÓN)
app.post('/registro', async (req, res) => {
  try {
    const { username, password } = req.body
    
    console.log('[REGISTRO] Datos recibidos:', { 
      username, 
      passwordLength: password?.length,
      passwordRaw: password // TEMPORAL: para debug
    })
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Usuario y contraseña son requeridos' })
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' })
    }

    // Verificar si el usuario ya existe
    const [existing] = await pool.query(
      'SELECT id FROM usuario WHERE username = ?',
      [username]
    )

    if (existing.length > 0) {
      console.log('[REGISTRO] ❌ Usuario ya existe:', username)
      return res.status(400).json({ error: 'El usuario ya existe' })
    }

    // Hashear la contraseña
    const hashedPassword = await bcrypt.hash(password, 10)
    
    console.log('[REGISTRO] Hash generado:', {
      original: password, // TEMPORAL: para debug
      hash: hashedPassword.substring(0, 30) + '...',
      hashLength: hashedPassword.length
    })
    
    // Insertar nuevo usuario (admin = false por defecto)
    const [result] = await pool.query(
      'INSERT INTO usuario (username, password, admin) VALUES (?, ?, ?)',
      [username, hashedPassword, 0]
    )
    
    console.log(`[REGISTRO] ✅ Usuario registrado exitosamente: ${username} (ID: ${result.insertId})`)
    
    // Verificar que se guardó correctamente
    const [verificacion] = await pool.query(
      'SELECT id, username, password, admin FROM usuario WHERE id = ?',
      [result.insertId]
    )
    
    console.log('[REGISTRO] Verificación en DB:', {
      id: verificacion[0].id,
      username: verificacion[0].username,
      passwordHash: verificacion[0].password.substring(0, 30) + '...',
      admin: verificacion[0].admin
    })
    
    res.json({ 
      success: true, 
      mensaje: 'Usuario registrado correctamente. Ya puedes iniciar sesión.' 
    })
    
  } catch (error) {
    console.error('[REGISTRO] ❌ Error en registro:', error)
    res.status(500).json({ error: 'Error al registrar usuario: ' + error.message })
  }
})

// Endpoint de login
app.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body
    
    console.log('[LOGIN] Datos recibidos:', { 
      username, 
      passwordLength: password?.length,
      passwordRaw: password // TEMPORAL: para debug
    })
    
    const [rows] = await pool.execute(
      'SELECT * FROM usuario WHERE username = ?', 
      [username]
    )
    
    if (rows.length === 0) {
      console.log('[LOGIN] ❌ Usuario no encontrado:', username)
      return res.status(401).json({ mensaje: 'Usuario o contraseña incorrecta' })
    }
    
    const user = rows[0]
    
    console.log('[LOGIN] Usuario encontrado en DB:', {
      id: user.id,
      username: user.username,
      admin: user.admin,
      passwordHashStart: user.password?.substring(0, 30) + '...',
      passwordHashLength: user.password?.length
    })
    
    console.log('[LOGIN] Comparando:', {
      passwordIngresada: password,
      hashEnDB: user.password.substring(0, 30) + '...'
    })
    
    const passwordMatch = await bcrypt.compare(password, user.password)
    
    console.log('[LOGIN] Resultado de bcrypt.compare:', passwordMatch)
    
    if (!passwordMatch) {
      console.log('[LOGIN] ❌ Contraseña incorrecta para:', username)
      return res.status(401).json({ mensaje: 'Usuario o contraseña incorrecta' })
    }
    
    req.session.userId = user.id
    req.session.username = user.username
    req.session.isAdmin = Boolean(user.admin)
    
    console.log(`[LOGIN] ✅ Login exitoso - Usuario: ${user.username}, Admin: ${req.session.isAdmin}`)
    
    res.json({ 
      mensaje: 'Has iniciado sesión correctamente',
      redirect: '/index2.html',
      isAdmin: req.session.isAdmin
    })
    
  } catch (error) {
    console.error('[LOGIN] ❌ Error en login:', error)
    res.status(500).json({ mensaje: 'Error al procesar el inicio de sesión' })
  }
})

app.post('/logout', (req, res) => {
  const username = req.session.username
  req.session.destroy(err => {
    if (err) return res.status(500).json({ mensaje: 'Error al cerrar sesión' })
    console.log(`[LOGOUT] Usuario: ${username}`)
    res.clearCookie('sid')
    res.json({ mensaje: 'Has cerrado sesión' })
  })
})

app.get('/perfil', requireAuth, (req, res) => {
  res.json({ 
    id: req.session.userId, 
    usuario: req.session.username,
    isAdmin: req.session.isAdmin 
  })
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`)
})