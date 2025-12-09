function sanitizar(input){
    if(!input) return '';
    return input.replace(/<[^>]*>?/gm,'').replace(/<\?php.*?\?>/gs,'');
}

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

// DEBUG: Mostrar variables de entorno (sin password completa)
console.log('🔍 Variables de entorno MySQL detectadas:')
console.log('   MYSQL_HOST:', process.env.MYSQL_HOST || 'undefined')
console.log('   MYSQLHOST:', process.env.MYSQLHOST || 'undefined')
console.log('   MYSQL_PORT:', process.env.MYSQL_PORT || 'undefined')
console.log('   MYSQLPORT:', process.env.MYSQLPORT || 'undefined')
console.log('   MYSQL_USER:', process.env.MYSQL_USER || 'undefined')
console.log('   MYSQLUSER:', process.env.MYSQLUSER || 'undefined')
console.log('   MYSQL_DATABASE:', process.env.MYSQL_DATABASE || 'undefined')
console.log('   MYSQLDATABASE:', process.env.MYSQLDATABASE || 'undefined')
console.log('   PASSWORD exists:', !!(process.env.MYSQL_PASSWORD || process.env.MYSQLPASSWORD))

// Obtener puerto y convertir a número
const portFromEnv = process.env.MYSQL_PORT || process.env.MYSQLPORT;
const mysqlPort = portFromEnv ? parseInt(portFromEnv, 10) : 55194;

console.log('🔧 Puerto detectado:', portFromEnv, '→ convertido a:', mysqlPort);

const dbConfig = {
  host: process.env.MYSQL_HOST || process.env.MYSQLHOST,
  port: mysqlPort,
  user: process.env.MYSQL_USER || process.env.MYSQLUSER,
  password: process.env.MYSQL_PASSWORD || process.env.MYSQLPASSWORD,
  database: process.env.MYSQL_DATABASE || process.env.MYSQLDATABASE,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 60000
}

console.log('🔧 Configuración MySQL final:')
console.log('   Host:', dbConfig.host)
console.log('   Port:', dbConfig.port, '(type:', typeof dbConfig.port, ')')
console.log('   User:', dbConfig.user)
console.log('   Database:', dbConfig.database)

const pool = mysql.createPool(dbConfig)

// Verificar conexión a la base de datos al iniciar
pool.getConnection()
  .then(connection => {
    console.log('✅ Conectado a MySQL exitosamente')
    console.log('   Host:', process.env.MYSQL_HOST || process.env.MYSQLHOST)
    console.log('   Database:', process.env.MYSQL_DATABASE || process.env.MYSQLDATABASE)
    connection.release()
  })
  .catch(err => {
    console.error('❌ Error al conectar a MySQL:', err.message)
    console.error('   Host intentado:', process.env.MYSQL_HOST || process.env.MYSQLHOST)
    console.error('   Port intentado:', process.env.MYSQL_PORT || process.env.MYSQLPORT || 44431)
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

// NUEVA RUTA: Endpoint para verificar sesión
app.get('/api/sesion', (req, res) => {
  if (req.session && req.session.userId) {
    res.json({
      loggedIn: true,
      username: req.session.username,
      isAdmin: req.session.isAdmin || false
    })
  } else {
    res.json({
      loggedIn: false
    })
  }
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

    const nombre = sanitizar((req.body.nombre || '').toString().trim())
    const descripcion = sanitizar((req.body.descripcion || '').toString().trim())
    const precio = parseFloat(sanitizar(String(req.body.precio || '0')).replace(',', '.')) || 0
    const cantidad = parseInt(sanitizar(String(req.body.cantidad || '0'))) || 0
    const imagen_url = sanitizar((req.body.imagen_url || '').toString().trim()) || null

    if (!nombre || !precio || Number.isNaN(cantidad)) {
      return res.status(400).json({ error: 'Nombre, precio y cantidad son requeridos' })
    }

    const [result] = await pool.query(
      'INSERT INTO pan (nombre, descripcion, precio, cantidad, imagen_url) VALUES (?, ?, ?, ?, ?)',
      [nombre, descripcion || null, precio, cantidad, imagen_url || null]
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
    const nombre = sanitizar((req.body.nombre || '').toString().trim())
    const descripcion = sanitizar((req.body.descripcion || '').toString().trim())
    const precio = parseFloat(sanitizar(String(req.body.precio || '0')).replace(',', '.')) || 0
    const cantidad = parseInt(sanitizar(String(req.body.cantidad || '0'))) || 0
    const imagen_url = sanitizar((req.body.imagen_url || '').toString().trim()) || null

    await pool.query(
      'UPDATE pan SET nombre = ?, descripcion = ?, precio = ?, cantidad = ?, imagen_url = ? WHERE id = ?',
      [nombre, descripcion || null, precio, cantidad, imagen_url || null, parseInt(sanitizar(String(id)))]
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

    const id = parseInt(sanitizar(String(req.params.id)))
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
    // Verificar que el usuario esté autenticado
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ error: 'Debes iniciar sesión para realizar un pedido' });
    }

    const productosRaw = req.body.productos
    if (!productosRaw || !Array.isArray(productosRaw) || productosRaw.length === 0) {
      return res.status(400).json({ error: 'El carrito está vacío' })
    }

    // Obtener información del usuario
    const usuarioId = req.session.userId;
    const username = req.session.username;

    // Sanitizar y normalizar productos del carrito
    const productos = productosRaw.map(p => ({
      id: parseInt(sanitizar(String(p.id))),
      nombre: sanitizar((p.nombre || '').toString()),
      precio: parseFloat(sanitizar(String(p.precio || '0')).replace(',', '.')) || 0,
      cantidad: parseInt(sanitizar(String(p.cantidad || '0'))) || 0
    }))

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

      // Insertar pedido con información del usuario
      await connection.query(
        'INSERT INTO pedidos (nombre, precio, cantidad, usuario_id, username) VALUES (?, ?, ?, ?, ?)',
        [
          producto.nombre,
          producto.precio,
          producto.cantidad,
          usuarioId,
          username
        ]
      );

      // Actualizar stock
      await connection.query(
        'UPDATE pan SET cantidad = cantidad - ? WHERE id = ?',
        [producto.cantidad, producto.id]
      );
    }

    await connection.commit();
    console.log(`[PEDIDO] Usuario: ${username} (ID: ${usuarioId}) - Guardó pedido con ${productos.length} productos`);

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

// Endpoint para registro de nuevos usuarios
app.post('/registro', async (req, res) => {
  try {
    const username = sanitizar((req.body.username || '').toString().trim())
    const password = req.body.password // conservar password tal cual para bcrypt
    if (!username || !password) {
      return res.status(400).json({ error: 'Usuario y contraseña son requeridos o hay un error de escritura' })
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

    // Hashear la contraseña (sin sanitizarla)
    const hashedPassword = await bcrypt.hash(password, 10)

    // Insertar nuevo usuario (admin = false por defecto)
    const [result] = await pool.query(
      'INSERT INTO usuario (username, password, admin) VALUES (?, ?, ?)',
      [username, hashedPassword, 0]
    )

    console.log(`[REGISTRO] ✅ Usuario registrado exitosamente: ${username} (ID: ${result.insertId})`)

    res.json({
      success: true,
      mensaje: 'Usuario registrado correctamente. Ya puedes iniciar sesión.'
    })

  } catch (error) {
    console.error('[REGISTRO] ❌ Error en registro:', error)
    res.status(500).json({ error: 'Error al registrar usuario: ' + error.message })
  }
})

// Endpoint de login (COMPATIBLE CON CONTRASEÑAS PLANAS Y BCRYPT)
app.post('/login', async (req, res) => {
  try {
    const username = sanitizar((req.body.username || '').toString().trim())
    const password = req.body.password // comparar con bcrypt sin sanitizar

    if (!username || !password) {
      return res.status(400).json({ mensaje: 'Usuario y contraseña son requeridos' })
    }

    const [rows] = await pool.execute(
      'SELECT * FROM usuario WHERE username = ?',
      [username]
    )

    if (rows.length === 0) {
      console.log('[LOGIN] ❌ Usuario no encontrado:', username)
      return res.status(401).json({ mensaje: 'Usuario o contraseña incorrecta' })
    }

    const user = rows[0]
    let passwordMatch = false

    // Verificar si la contraseña está hasheada con bcrypt (empieza con $2b$ o $2a$ o $2y$)
    if (user.password.startsWith('$2b$') || user.password.startsWith('$2a$') || user.password.startsWith('$2y$')) {
      // Contraseña hasheada - usar bcrypt
      passwordMatch = await bcrypt.compare(password, user.password)
      console.log('[LOGIN] Verificación bcrypt:', passwordMatch)
    } else {
      // Contraseña en texto plano - comparación directa
      passwordMatch = (password === user.password)
      console.log('[LOGIN] Verificación texto plano:', passwordMatch)
      
      // OPCIONAL: Actualizar automáticamente a bcrypt después del login exitoso
      if (passwordMatch) {
        const hashedPassword = await bcrypt.hash(password, 10)
        await pool.query(
          'UPDATE usuario SET password = ? WHERE id = ?',
          [hashedPassword, user.id]
        )
        console.log(`[LOGIN] ✅ Contraseña actualizada a bcrypt para usuario: ${username}`)
      }
    }

    if (!passwordMatch) {
      console.log('[LOGIN] ❌ Contraseña incorrecta para:', username)
      return res.status(401).json({ mensaje: 'Usuario o contraseña incorrecta' })
    }

    req.session.userId = user.id
    req.session.username = user.username
    req.session.isAdmin = Boolean(user.admin)

    console.log(`[LOGIN] ✅ Login exitoso - Usuario: ${user.username}, Admin: ${req.session.isAdmin}`)

    // Redirigir según tipo de usuario
    const redirect = req.session.isAdmin ? '/index2.html' : '/'

    res.json({
      mensaje: 'Has iniciado sesión correctamente',
      redirect: redirect,
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

// Ver pedidos del usuario actual
app.get('/api/mis-pedidos', requireAuth, async (req, res) => {
  try {
    const [pedidos] = await pool.query(
      'SELECT * FROM pedidos WHERE usuario_id = ? ORDER BY id DESC',
      [req.session.userId]
    );
    res.json(pedidos);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error al obtener pedidos' });
  }
});

// Ver TODOS los pedidos (SOLO ADMIN)
app.get('/api/pedidos', requireAuth, requireAdmin, async (req, res) => {
  try {
    const [pedidos] = await pool.query(
      `SELECT 
        p.id,
        p.nombre,
        p.precio,
        p.cantidad,
        p.usuario_id,
        p.username,
        p.fecha_pedido,
        COALESCE(p.username, 'Invitado') as usuario_nombre
      FROM pedidos p 
      ORDER BY p.fecha_pedido DESC, p.id DESC`
    );
    res.json(pedidos);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error al obtener pedidos' });
  }
});

const PORT = process.env.PORT || 55194
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`)
})