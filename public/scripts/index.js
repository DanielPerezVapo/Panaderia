let carrito = [];
let sesionActiva = false;
let usuarioActual = null;

// Toggle menú móvil
document.addEventListener('DOMContentLoaded', () => {
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');
    
    if (mobileMenuBtn && mobileMenu) {
        mobileMenuBtn.addEventListener('click', () => {
            mobileMenu.classList.toggle('hidden');
        });
        
        // Cerrar menú al hacer click en un enlace
        const mobileLinks = mobileMenu.querySelectorAll('a');
        mobileLinks.forEach(link => {
            link.addEventListener('click', () => {
                mobileMenu.classList.add('hidden');
            });
        });
    }
});

// Verificar sesión al cargar la página
async function verificarSesion() {
    try {
        const response = await fetch('/api/sesion');
        const data = await response.json();
        
        if (data.loggedIn) {
            sesionActiva = true;
            usuarioActual = data.username;
            actualizarUIConSesion(data.username, data.isAdmin);
            
            // Mostrar sección "Mis Pedidos" en ambos menús
            document.getElementById('mis-pedidos-link')?.classList.remove('hidden');
            document.getElementById('mis-pedidos-link-mobile')?.classList.remove('hidden');
            document.getElementById('mis-pedidos')?.classList.remove('hidden');
            
            // Cargar pedidos del usuario
            cargarMisPedidos();
        }
    } catch (error) {
        console.error('Error al verificar sesión:', error);
    }
}

// Función para cargar los pedidos del usuario
async function cargarMisPedidos() {
    try {
        const response = await fetch('/api/mis-pedidos');
        
        if (!response.ok) {
            throw new Error('Error al cargar pedidos');
        }
        
        const pedidos = await response.json();
        const container = document.getElementById('pedidos-container');
        
        if (pedidos.length === 0) {
            container.innerHTML = `
                <div class="text-center py-12">
                    <p class="text-2xl text-stone-600 mb-4">📦</p>
                    <p class="text-lg text-stone-600">Aún no has realizado ningún pedido</p>
                    <a href="#productos" class="inline-block mt-6 px-6 py-3 bg-stone-800 text-white rounded-lg hover:bg-stone-700 transition-colors">
                        Ver Productos
                    </a>
                </div>
            `;
            return;
        }
        
        // Agrupar pedidos por fecha (hasta el minuto)
        const pedidosAgrupados = {};
        pedidos.forEach(pedido => {
            const fechaObj = new Date(pedido.fecha_pedido);
            
            // Crear clave agrupando por fecha hasta el minuto
            const fechaKey = `${fechaObj.getFullYear()}-${String(fechaObj.getMonth()+1).padStart(2,'0')}-${String(fechaObj.getDate()).padStart(2,'0')} ${String(fechaObj.getHours()).padStart(2,'0')}:${String(fechaObj.getMinutes()).padStart(2,'0')}`;
            
            if (!pedidosAgrupados[fechaKey]) {
                pedidosAgrupados[fechaKey] = {
                    fecha: fechaObj.toLocaleString('es-ES', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    }),
                    fecha_raw: pedido.fecha_pedido,
                    items: [],
                    total: 0
                };
            }
            
            pedidosAgrupados[fechaKey].items.push(pedido);
            pedidosAgrupados[fechaKey].total += parseFloat(pedido.precio) * parseInt(pedido.cantidad);
        });
        
        // Convertir a array y ordenar por fecha descendente
        const pedidosArray = Object.values(pedidosAgrupados).sort((a, b) => 
            new Date(b.fecha_raw) - new Date(a.fecha_raw)
        );
        
        // Mostrar pedidos agrupados
        container.innerHTML = pedidosArray.map((grupo, index) => `
            <div class="bg-white rounded-lg shadow-sm p-6 mb-6">
                <div class="flex justify-between items-center mb-4 pb-4 border-b">
                    <div>
                        <h3 class="text-xl font-light">Pedido #${pedidosArray.length - index}</h3>
                        <p class="text-sm text-stone-600">${grupo.fecha}</p>
                    </div>
                    <div class="text-right">
                        <p class="text-sm text-stone-600">Total</p>
                        <p class="text-2xl font-light text-green-700">$${grupo.total.toFixed(2)}</p>
                    </div>
                </div>
                
                <div class="space-y-3">
                    ${grupo.items.map(item => `
                        <div class="flex justify-between items-center py-2 border-b border-stone-100">
                            <div class="flex-1">
                                <p class="font-light">${item.nombre}</p>
                                <p class="text-sm text-stone-600">Cantidad: ${item.cantidad}</p>
                            </div>
                            <div class="text-right">
                                <p class="font-light">$${parseFloat(item.precio).toFixed(2)} c/u</p>
                                <p class="text-sm text-stone-600">Subtotal: $${(parseFloat(item.precio) * parseInt(item.cantidad)).toFixed(2)}</p>
                            </div>
                        </div>
                        <button class="ticket-btn ml-4 text-blue-600 hover:text-blue-800 text-xl" 
                                data-pedido="${item.id_pedido}"
                                data-nombre="${item.nombre}"
                                data-precio="${item.precio}"
                                data-cantidad="${item.cantidad}"
                                title="Imprimir ticket">
                            Imprimir Ticket🧾
                        </button>
                    `).join('')}
                </div>
            </div>
        `).join('');

        // Agregar event listeners a los botones de ticket
        document.querySelectorAll('.ticket-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const pedidoId = btn.dataset.pedido;
                const nombre = btn.dataset.nombre;
                const precio = btn.dataset.precio;
                const cantidad = btn.dataset.cantidad;
                console.log('Imprimiendo ticket...');
                generarDatosDelTicket(pedidoId, nombre, precio, cantidad);
            });
        });

        
        
    } catch (error) {
        console.error('Error al cargar pedidos:', error);
        document.getElementById('pedidos-container').innerHTML = `
            <div class="text-center py-12">
                <p class="text-red-600">Error al cargar tus pedidos. Intenta recargar la página.</p>
            </div>
        `;
    }
}


function generarDatosDelTicket(i, i_n,i_p,i_c ) {
    // Simulación de datos de compra
    const datosDeCompra = {
        idTransaccion: i,
        fecha: new Date().toLocaleString(),
        cliente: "Cliente Ejemplo",
        articulos: [
            { nombre: i_n, cantidad: i_c, precio: i_p },
            { nombre: i_n, cantidad: i_c, precio: i_p }
        ],
    };
    console.log('Datos del ticket generados:', datosDeCompra);
    return datosDeCompra;
}

// Actualizar UI cuando hay sesión activa
function actualizarUIConSesion(username, isAdmin) {
    const sesionContainer = document.getElementById('sesion-container');
    const sesionContainerMobile = document.getElementById('sesion-container-mobile');
    const loginContainer = document.getElementById('login-container');
    
    // Reemplazar botón de login por botón de usuario y cerrar sesión (DESKTOP)
    sesionContainer.innerHTML = `
        <div class="flex items-center gap-4">
            <span class="text-stone-700 font-light">👤 ${username}</span>
            ${isAdmin ? '<a href="/index2.html" class="px-4 py-2 bg-stone-800 text-white rounded-lg hover:bg-stone-700 transition-colors text-sm">Panel Admin</a>' : ''}
            <button id="logout-btn" class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm">
                Cerrar Sesión
            </button>
        </div>
    `;

    // Actualizar menú MÓVIL
    if (sesionContainerMobile) {
        sesionContainerMobile.innerHTML = `
            <div class="flex flex-col gap-2">
                <span class="block text-stone-700 font-light py-2">👤 ${username}</span>
                ${isAdmin ? '<a href="/index2.html" class="block px-4 py-2 bg-stone-800 text-white rounded-lg hover:bg-stone-700 transition-colors text-sm text-center">Panel Admin</a>' : ''}
                <button id="logout-btn-mobile" class="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm">
                    Cerrar Sesión
                </button>
            </div>
        `;
    }

    // Ocultar formulario de login
    if (loginContainer) {
        loginContainer.innerHTML = `
            <div class="text-center">
                <h3 class="text-2xl font-light mb-4">¡Bienvenido, ${username}!</h3>
                <p class="text-stone-600 mb-4">Has iniciado sesión correctamente</p>
                <a href="#mis-pedidos" class="inline-block px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors mb-3">
                    📦 Ver Mis Pedidos
                </a>
                ${isAdmin ? '<a href="/index2.html" class="inline-block px-6 py-3 bg-stone-800 text-white rounded-lg hover:bg-stone-700 transition-colors ml-3">Ir al Panel de Administración</a>' : ''}
            </div>
        `;
    }

    // Agregar evento al botón de cerrar sesión (desktop y móvil)
    document.getElementById('logout-btn')?.addEventListener('click', cerrarSesion);
    document.getElementById('logout-btn-mobile')?.addEventListener('click', cerrarSesion);
}

// Función para cerrar sesión
async function cerrarSesion() {
    if (!confirm('¿Estás seguro de cerrar sesión?')) {
        return;
    }

    try {
        const response = await fetch('/logout', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            mostrarNotificacion('Sesión cerrada correctamente');
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        }
    } catch (error) {
        console.error('Error al cerrar sesión:', error);
        alert('Error al cerrar sesión');
    }
}

// Llamar a verificarSesion al cargar la página
document.addEventListener('DOMContentLoaded', function() {
    verificarSesion();
    cargarProductos();
});

// Abrir/Cerrar modal de registro
document.getElementById('mostrar-registro')?.addEventListener('click', function() {
    document.getElementById('registro-modal').classList.remove('hidden');
});

document.getElementById('cerrar-registro').addEventListener('click', function() {
    document.getElementById('registro-modal').classList.add('hidden');
    document.getElementById('registroForm').reset();
    document.getElementById('mensaje-registro').classList.add('hidden');
});

// Cerrar modal al hacer clic fuera
document.getElementById('registro-modal').addEventListener('click', function(e) {
    if (e.target === this) {
        this.classList.add('hidden');
        document.getElementById('registroForm').reset();
        document.getElementById('mensaje-registro').classList.add('hidden');
    }
});

// Manejo del formulario de registro
document.getElementById('registroForm').addEventListener('submit', async function(event) {
    event.preventDefault();
    
    const username = document.getElementById('reg-username').value;
    const password = document.getElementById('reg-password').value;
    const passwordConfirm = document.getElementById('reg-password-confirm').value;
    const registroButton = document.getElementById('registroButton');
    const mensajeDiv = document.getElementById('mensaje-registro');
    
    // Validar que las contraseñas coincidan
    if (password !== passwordConfirm) {
        mensajeDiv.classList.remove('hidden');
        mensajeDiv.className = 'mb-4 p-3 rounded-lg bg-red-100 text-red-800 border border-red-300';
        mensajeDiv.textContent = 'Las contraseñas no coinciden';
        return;
    }

    // Deshabilitar botón
    registroButton.disabled = true;
    registroButton.textContent = 'Registrando...';
    registroButton.classList.add('opacity-50', 'cursor-not-allowed');
    
    // Limpiar mensaje anterior
    mensajeDiv.classList.add('hidden');
    
    try {
        const response = await fetch('/registro', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                username: username, 
                password: password 
            })
        });

        const data = await response.json();
        const mensaje = data.mensaje || data.error || 'Ocurrió un error';
        
        // Mostrar mensaje
        mensajeDiv.classList.remove('hidden');
        mensajeDiv.textContent = mensaje;
        
        if (response.ok) {
            // Registro exitoso
            mensajeDiv.className = 'mb-4 p-3 rounded-lg bg-green-100 text-green-800 border border-green-300';
            
            // Limpiar formulario
            document.getElementById('registroForm').reset();
            
            // Cerrar modal después de 2 segundos
            setTimeout(function() {
                document.getElementById('registro-modal').classList.add('hidden');
                mensajeDiv.classList.add('hidden');
            }, 2000);
            
        } else {
            // Registro fallido
            mensajeDiv.className = 'mb-4 p-3 rounded-lg bg-red-100 text-red-800 border border-red-300';
        }
        
    } catch (error) {
        console.error('Error:', error);
        
        mensajeDiv.classList.remove('hidden');
        mensajeDiv.className = 'mb-4 p-3 rounded-lg bg-red-100 text-red-800 border border-red-300';
        mensajeDiv.textContent = 'Error al conectar con el servidor';
    } finally {
        // Rehabilitar botón SIEMPRE
        registroButton.disabled = false;
        registroButton.textContent = 'Registrarse';
        registroButton.classList.remove('opacity-50', 'cursor-not-allowed');
    }
});

// Función para agregar producto al carrito CON VALIDACIÓN DE STOCK
function agregarAlCarrito(id, nombre, precio, imagen_url, cantidadDisponible) {
    console.log('🛒 ===== INICIO agregarAlCarrito =====');
    console.log('🛒 Parámetros recibidos:', {id, nombre, precio, imagen_url, cantidadDisponible});
    console.log('� Tipo de ID:', typeof id, '- Valor:', id);
    console.log('📦 Carrito actual (length):', carrito.length);
    console.log('�📦 Carrito actual (contenido):', JSON.stringify(carrito, null, 2));
    
    const productoExistente = carrito.find(item => item.id === id);
    console.log('🔍 Producto existente encontrado:', productoExistente);
    
    if (productoExistente) {
        // Verificar si hay stock suficiente antes de incrementar
        if (productoExistente.cantidad >= cantidadDisponible) {
            console.warn('⚠️ Stock insuficiente para incrementar');
            alert(`No hay más stock disponible de ${nombre}. Solo quedan ${cantidadDisponible} unidades.`);
            return;
        }
        productoExistente.cantidad++;
        console.log('✅ Producto incrementado:', JSON.stringify(productoExistente, null, 2));
    } else {
        // Verificar stock disponible antes de agregar
        if (cantidadDisponible <= 0) {
            console.warn('⚠️ Producto agotado');
            alert(`${nombre} está agotado.`);
            return;
        }
        
        const nuevoProducto = {
            id: id,
            nombre: nombre,
            precio: parseFloat(precio),
            imagen_url: imagen_url,
            cantidad: 1,
            cantidadDisponible: cantidadDisponible
        };
        
        console.log('➕ Agregando nuevo producto:', JSON.stringify(nuevoProducto, null, 2));
        carrito.push(nuevoProducto);
        console.log('✅ Producto agregado. Nuevo length del carrito:', carrito.length);
    }
    
    console.log('📦 Carrito FINAL (length):', carrito.length);
    console.log('📦 Carrito FINAL (contenido):', JSON.stringify(carrito, null, 2));
    console.log('🛒 ===== Llamando actualizarCarrito =====');
    actualizarCarrito();
    console.log('🛒 ===== Mostrando notificación =====');
    mostrarNotificacion(`${nombre} agregado al carrito`);
    console.log('🛒 ===== FIN agregarAlCarrito =====');
}

// Función para actualizar el carrito visual
function actualizarCarrito() {
    console.log('🔄 Actualizando carrito visual...');
    
    const carritoItems = document.getElementById('carrito-items');
    const carritoCountBadges = document.querySelectorAll('.carrito-count-badge'); // Usar clase en vez de ID
    const totalProductos = document.getElementById('total-productos');
    const totalPrecio = document.getElementById('total-precio');
    
    // Calcular totales
    const cantidadTotal = carrito.reduce((sum, item) => sum + item.cantidad, 0);
    const precioTotal = carrito.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);
    
    console.log('📊 Totales calculados:', {cantidadTotal, precioTotal});
    
    // Actualizar TODOS los badges del carrito (desktop y móvil)
    carritoCountBadges.forEach(badge => {
        if (cantidadTotal > 0) {
            badge.textContent = cantidadTotal;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    });
    
    // Actualizar totales
    if (totalProductos) totalProductos.textContent = cantidadTotal;
    if (totalPrecio) totalPrecio.textContent = `$${precioTotal.toFixed(2)}`;
    
    // Actualizar lista de items
    if (!carritoItems) {
        console.warn('⚠️ Elemento carrito-items no encontrado');
        return;
    }
    
    if (carrito.length === 0) {
        carritoItems.innerHTML = '<p class="text-center text-stone-600">El carrito está vacío</p>';
    } else {
        carritoItems.innerHTML = carrito.map(item => `
            <div class="flex items-center gap-4 bg-stone-50 p-4 rounded-lg">
                <img src="${item.imagen_url || 'https://via.placeholder.com/80'}" 
                     alt="${item.nombre}" 
                     class="w-16 h-16 object-cover rounded"
                     onerror="this.src='https://via.placeholder.com/80'">
                <div class="flex-1">
                    <h4 class="font-light">${item.nombre}</h4>
                    <p class="text-sm text-stone-600">$${item.precio.toFixed(2)} x ${item.cantidad}</p>
                    <p class="text-xs text-stone-500">Disponible: ${item.cantidadDisponible}</p>
                    <p class="text-sm font-light">Subtotal: $${(item.precio * item.cantidad).toFixed(2)}</p>
                </div>
                <div class="flex flex-col gap-2">
                    <button onclick="cambiarCantidad(${item.id}, 1)" class="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700">+</button>
                    <button onclick="cambiarCantidad(${item.id}, -1)" class="px-2 py-1 bg-yellow-600 text-white text-xs rounded hover:bg-yellow-700">-</button>
                    <button onclick="eliminarDelCarrito(${item.id})" class="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700">🗑️</button>
                </div>
            </div>
        `).join('');
    }
    
    console.log('✅ Carrito visual actualizado');
}

// Función para cambiar cantidad CON VALIDACIÓN DE STOCK
function cambiarCantidad(id, cambio) {
    const producto = carrito.find(item => item.id === id);
    if (producto) {
        const nuevaCantidad = producto.cantidad + cambio;
        
        // Validar que no exceda el stock disponible
        if (nuevaCantidad > producto.cantidadDisponible) {
            alert(`No puedes agregar más de ${producto.cantidadDisponible} unidades de ${producto.nombre}.`);
            return;
        }
        
        producto.cantidad = nuevaCantidad;
        
        if (producto.cantidad <= 0) {
            eliminarDelCarrito(id);
        } else {
            actualizarCarrito();
        }
    }
}

// Función para eliminar producto del carrito
function eliminarDelCarrito(id) {
    carrito = carrito.filter(item => item.id !== id);
    actualizarCarrito();
}

// Función para vaciar el carrito
document.getElementById('vaciar-carrito').addEventListener('click', function() {
    if (confirm('¿Estás seguro de vaciar el carrito?')) {
        carrito = [];
        actualizarCarrito();
        mostrarNotificacion('Carrito vaciado');
    }
});

// Función para guardar carrito en base de datos (ACTUALIZADA)
document.getElementById('guardar-carrito').addEventListener('click', async function() {
    if (carrito.length === 0) {
        alert('El carrito está vacío');
        return;
    }

    // Verificar si hay sesión activa
    if (!sesionActiva) {
        alert('Debes iniciar sesión para realizar un pedido');
        // Scroll hacia el formulario de login
        document.getElementById('loginForm')?.scrollIntoView({ behavior: 'smooth' });
        return;
    }

    if (!confirm('¿Deseas hacer tu compra?')) {
        return;
    }

    try {
        const response = await fetch('/api/carrito/guardar', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ productos: carrito })
        });

        const data = await response.json();

        if (response.ok) {
            alert(`${data.mensaje}\n\nGracias por tu pedido, ${usuarioActual}!`);
            carrito = [];
            actualizarCarrito();
            cerrarCarritoPanel();
            await cargarProductos();
            
            // Recargar pedidos del usuario
            await cargarMisPedidos();
            
            // Scroll a "Mis Pedidos"
            document.getElementById('mis-pedidos')?.scrollIntoView({ behavior: 'smooth' });
        } else {
            alert(data.error || 'Error al guardar el pedido');
        }

    } catch (error) {
        console.error('Error:', error);
        alert('Error al conectar con el servidor');
    }
});

// Función para mostrar notificación
function mostrarNotificacion(mensaje) {
    const notif = document.createElement('div');
    notif.className = 'fixed top-20 right-4 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg z-50';
    notif.textContent = mensaje;
    document.body.appendChild(notif);
    
    setTimeout(() => {
        notif.remove();
    }, 2000);
}

// Abrir/Cerrar panel del carrito
// Abrir carrito (delegación de eventos para todos los botones con clase carrito-btn-toggle)
document.addEventListener('click', function(e) {
    if (e.target.closest('.carrito-btn-toggle')) {
        document.getElementById('carrito-panel').classList.remove('translate-x-full');
        document.getElementById('carrito-overlay').classList.remove('hidden');
    }
    
    // Delegar evento para botones de agregar al carrito
    if (e.target.classList.contains('btn-agregar-carrito') && !e.target.disabled) {
        e.preventDefault(); // Prevenir comportamiento por defecto
        e.stopPropagation(); // Detener propagación
        
        const btn = e.target;
        console.log('🎯 Click detectado en botón agregar');
        console.log('📊 Dataset completo del botón:', btn.dataset);
        
        const id = parseInt(btn.dataset.id);
        const nombre = btn.dataset.nombre;
        const precio = parseFloat(btn.dataset.precio);
        const imagen_url = btn.dataset.imagen;
        const cantidadDisponible = parseInt(btn.dataset.stock);
        
        console.log('📊 Datos parseados:', {id, nombre, precio, imagen_url, cantidadDisponible});
        console.log('📦 Carrito ANTES de agregar:', JSON.parse(JSON.stringify(carrito)));
        
        agregarAlCarrito(id, nombre, precio, imagen_url, cantidadDisponible);
        
        console.log('📦 Carrito DESPUÉS de agregar:', JSON.parse(JSON.stringify(carrito)));
    }
});

function cerrarCarritoPanel() {
    document.getElementById('carrito-panel').classList.add('translate-x-full');
    document.getElementById('carrito-overlay').classList.add('hidden');
}

document.getElementById('cerrar-carrito').addEventListener('click', cerrarCarritoPanel);
document.getElementById('carrito-overlay').addEventListener('click', cerrarCarritoPanel);

// Función para cargar productos desde la base de datos
async function cargarProductos() {
    try {
        const response = await fetch('/api/productos');
        
        if (!response.ok) {
            throw new Error('Error al cargar productos');
        }
        
        const productos = await response.json();
        const container = document.getElementById('productos-container');
        
        // Limpiar contenedor
        container.innerHTML = '';
        
        // Crear tarjeta para cada producto
        productos.forEach(producto => {
            const article = document.createElement('article');
            article.className = 'bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-xl transition-shadow';
            
            const cantidadDisponible = producto.cantidad || 0;
            const agotado = cantidadDisponible <= 0;
            
            article.innerHTML = `
                <div class="aspect-square overflow-hidden bg-stone-100 relative">
                    <img src="${producto.imagen_url || 'https://via.placeholder.com/400?text=Sin+Imagen'}" 
                         alt="${producto.nombre}" 
                         class="w-full h-full object-cover hover:scale-105 transition-transform duration-500 ${agotado ? 'opacity-50' : ''}"
                         onerror="this.src='https://via.placeholder.com/400?text=Sin+Imagen'">
                    ${agotado ? '<div class="absolute inset-0 flex items-center justify-center bg-black/50"><span class="text-white text-2xl font-bold">AGOTADO</span></div>' : ''}
                </div>
                <div class="p-6">
                    <h3 class="text-2xl font-light mb-2">${producto.nombre}</h3>
                    <p class="text-stone-600 mb-2">${producto.descripcion || 'Sin descripción disponible'}</p>
                    
                    <p class="text-sm mb-4 ${agotado ? 'text-red-600 font-semibold' : 'text-green-600'}">
                        ${agotado ? '❌ Sin stock' : `✅ Disponible: ${cantidadDisponible} unidades`}
                    </p>
                    
                    <div class="flex justify-between items-center mb-4">
                        <p class="text-xl font-light">$${parseFloat(producto.precio).toFixed(2)}</p>
                    </div>
                    
                    <button 
                        class="btn-agregar-carrito w-full px-4 py-2 text-sm rounded-lg transition-colors ${agotado ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'} text-white"
                        data-id="${producto.id}"
                        data-nombre="${producto.nombre.replace(/"/g, '&quot;')}"
                        data-precio="${producto.precio}"
                        data-imagen="${producto.imagen_url || ''}"
                        data-stock="${cantidadDisponible}"
                        ${agotado ? 'disabled' : ''}>
                        ${agotado ? '❌ Agotado' : '🛒 Agregar al Carrito'}
                    </button>
                </div>
            `;
            
            container.appendChild(article);
        });
        
        if (productos.length === 0) {
            container.innerHTML = '<p class="text-center text-stone-600 col-span-full text-lg">No hay productos disponibles en este momento.</p>';
        }
        
    } catch (error) {
        console.error('Error:', error);
        document.getElementById('productos-container').innerHTML = 
            '<p class="text-center text-red-600 col-span-full text-lg">Error al cargar los productos. Intenta recargar la página.</p>';
    }
}

// Manejo del login
document.getElementById('loginForm')?.addEventListener('submit', function(event) {
    event.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const loginButton = document.getElementById('loginButton');
    const mensajeDiv = document.getElementById('mensaje');
    
    loginButton.disabled = true;
    loginButton.textContent = 'Iniciando sesión...';
    loginButton.classList.add('opacity-50', 'cursor-not-allowed');
    
    mensajeDiv.classList.add('hidden');
    
    fetch('/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username: username, password: password })
    })
    .then(function(response) {
        return response.json().then(function(data) {
            return { status: response.status, data: data };
        });
    })
    .then(function(result) {
        mensajeDiv.classList.remove('hidden');
        mensajeDiv.textContent = result.data.mensaje;
        
        if (result.status === 200) {
            mensajeDiv.className = 'mb-4 p-3 rounded-lg bg-green-100 text-green-800 border border-green-300';
            
            setTimeout(function() {
                window.location.href = result.data.redirect;
            }, 500);
            
        } else {
            mensajeDiv.className = 'mb-4 p-3 rounded-lg bg-red-100 text-red-800 border border-red-300';
            
            loginButton.disabled = false;
            loginButton.textContent = 'Entrar';
            loginButton.classList.remove('opacity-50', 'cursor-not-allowed');
        }
    })
    .catch(function(error) {
        console.error('Error:', error);
        
        mensajeDiv.classList.remove('hidden');
        mensajeDiv.className = 'mb-4 p-3 rounded-lg bg-red-100 text-red-800 border border-red-300';
        mensajeDiv.textContent = 'Error al conectar con el servidor. Intenta nuevamente.';
        
        loginButton.disabled = false;
        loginButton.textContent = 'Entrar';
        loginButton.classList.remove('opacity-50', 'cursor-not-allowed');
    });
});

// Exponer funciones globalmente para que funcionen con onclick en HTML
window.agregarAlCarrito = agregarAlCarrito;
window.eliminarDelCarrito = eliminarDelCarrito;
