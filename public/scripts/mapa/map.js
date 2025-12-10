const map = L.map('map').setView([19.432672, -99.133062], 13);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    minZoom: 12,
    maxZoom: 19,
}).addTo(map);

map.locate({enableHighAccuracy:true});

//encontrar ubicación
map.on('locationfound', e => {
    const coords = [e.latlng.lat, e.latlng.lng];
    const marker = L.marker(coords);
    marker.bindPopup('Estoy aquí');
    map.addLayer(marker);
    console.log('Tu ubicación:', coords);
});

// Marcador de la panadería
var marcador = L.marker([19.418199, -99.096393]).addTo(map);
marcador.bindPopup('Panaderia');