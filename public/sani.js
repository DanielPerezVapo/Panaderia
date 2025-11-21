function validarNombreSeguro(valor) {
    return /^[A-Za-zÁÉÍÓÚáéíóúÑñ\s]+$/.test(valor.trim()); // \s permite espacios
}



document.addEventListener('DOMContentLoaded', function() {


    var formAgregar = document.querySelector('form[action="/agregarUsuario"]')
    if (formAgregar) {
        formAgregar.addEventListener('submit', function(e) {
            var nombre = document.getElementById('nombre').value;    
            if (!validarNombreSeguro(nombre)) {
                alert('El nombre solo debe contener letras y espacios, sin números ni caracteres especiales.');
                e.preventDefault();
            }
        });
    }



    var formEditar = document.querySelector('form[action="/editarUsuario"]');
    if (formEditar) {
        formEditar.addEventListener('submit', function(e) {
            var nombreActual = document.getElementById('nombreActual').value;
            var nuevoNombre = document.getElementById('nuevoNombre').value;
            if (!validarNombreSeguro(nombreActual) || !validarNombreSeguro(nuevoNombre)) {
                alert('Ningún nombre debe contener números, etiquetas ni caracteres especiales.');
                e.preventDefault();
            }
        });
    }



    var formBorrar = document.querySelector('form[action="/borrarUsuario"]');
    if (formBorrar) {
        formBorrar.addEventListener('submit', function(e) {
            var nombreBorrar = document.getElementById('nombreBorrar').value;
            if (!validarNombreSeguro(nombreBorrar)) {
                alert('El nombre solo debe contener letras y espacios, sin números ni caracteres especiales.');
                e.preventDefault();
            }
        });
    }
});