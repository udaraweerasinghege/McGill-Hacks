
// Config
var name;
L.mapbox.accessToken = config.mapbox.accessToken;

// Utilities
function guid() {
  function s4() {
    return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
  }
  return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
}

// Get current UUID
var myUuid = localStorage.getItem('myUuid');
if (!myUuid) {
  myUuid = guid();
  localStorage.setItem('myUuid', myUuid);
}

// Initialize map
var map = L.mapbox.map('map', config.mapbox.mapId, {
  zoomControl: false,
  attributionControl: false,
  tileLayer: {
    maxNativeZoom: 19
  }
});

// Stupid routing
var mapId = location.hash.replace(/^#/, '');
if (!mapId) {
  mapId = (Math.random() + 1).toString(36).substring(2, 12);
  location.hash = mapId;
}

// Firebase
var firebase = new Firebase('https://' + config.firebase + '.firebaseio.com/');
var markersRef = firebase.child('maps/' + mapId);
var markers = {};

function addPoint(uuid, position) {
  var marker = L.marker([position.coords.latitude, position.coords.longitude], {
    // zIndexOffset: (uuid === myUuid ? 1000 : 0),
    icon: L.mapbox.marker.icon({
      'marker-size': 'medium',
      'marker-color': (uuid === myUuid ? '#2196f3' : '#ff9800')
    })
  })
  marker.bindPopup(position.name).addTo(map)
  
  marker.openPopup();

  markers[uuid] = marker;

  map.fitBounds(Object.keys(markers).map(function(uuid) {
    return markers[uuid].getLatLng()
  }))
}

function removePoint(uuid) {
  map.removeLayer(markers[uuid])
  //markers[uuid] = null
}

function updatePoint(uuid, position) {
  console.log(position);
  var marker = markers[uuid]
  marker.setLatLng([position.coords.latitude, position.coords.longitude])
}

function putPoint(uuid, position) {
  if (markers[uuid])
    updatePoint(uuid, position)
  else
    addPoint(uuid, position)
}

var watchPositionId;

map.on('ready', function() {
  bootbox.prompt("What is your name?", function(result) {
    bootbox.confirm('Share your url so your friends can track you', function() {
      name = result;
      function successCoords(position) {
        if (!position.coords) return

        markersRef.child(myUuid).set({
          name: name,
          coords: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          },
          timestamp: Math.floor(Date.now() / 1000)
        })

        // map.panTo([position.coords.latitude, position.coords.longitude])
      }  

      function errorCoords() {
        console.log('Unable to get current position')
      }

      var options = {enableHighAccuracy: true, frequency: 1 };

      watchPositionId = navigator.geolocation.watchPosition(successCoords, errorCoords, options);

      markersRef.on('child_added', function(childSnapshot) {
        var uuid = childSnapshot.key()
        var position = childSnapshot.val()

        addPoint(uuid, position)
      })

      markersRef.on('child_changed', function(childSnapshot) {
        var uuid = childSnapshot.key()
        var position = childSnapshot.val()
        console.log('child changed', position);
        putPoint(uuid, position)
      })

      markersRef.on('child_removed', function(oldChildSnapshot) {
        var uuid = oldChildSnapshot.key()

        removePoint(uuid)
      })  
    })              
    
  });
});

// Remove old markers
setInterval(function() {
  markersRef.limitToFirst(100).once('value', function(snap) {
    var now = Math.floor(Date.now() / 1000)

    snap.forEach(function(childSnapshot) {
      var uuid = childSnapshot.key()
      if (childSnapshot.val().timestamp < now - 60 * 30) {
        markersRef.child(uuid).set(null)
        //markers[uuid] = null
      }
    })
  })
}, 5000);


