// Copyright 2021 Google LLC

// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at

//     https://www.apache.org/licenses/LICENSE-2.0

// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { Loader } from '@googlemaps/js-api-loader';
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import cases from '/src/assets/cases.json' assert {type: 'json'}

//json properties
var case1 = cases[0][0];
var json_latitude = case1["Latitude"];
var json_longitude = case1["Longitude"];
var json_vertical_acc = case1["Vertical accuracy"];
var json_horizontal_acc = case1["Horizontal accuracy"];
var json_altitude = case1["Altitude"];
var json_activity = case1["Activity"];
var json_floor = case1["Floor label"];
var json_timestamp = case1["Timestamp"];

const apiOptions = {
  apiKey: 'AIzaSyB7_iUwIzCFUVNtXtBU5XyrlwtYHy6vwUM',
  version: "beta"
};

const mapOptions = {
  "tilt": 0,
  "heading": 0,
  "zoom": 18,
  "center": { lat: json_latitude, lng: json_longitude },
  "mapId": "9221e2194dfa8f5e"
}

async function initMap() {    
  const mapDiv = document.getElementById("map");
  const apiLoader = new Loader(apiOptions);
  await apiLoader.load();
  return new google.maps.Map(mapDiv, mapOptions);
}


function initWebGLOverlayView(map) {  
  let scene, renderer, camera, loader;
  const webGLOverlayView = new google.maps.WebGLOverlayView();

  webGLOverlayView.onAdd = () => {   
    // set up the scene
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera();
    const ambientLight = new THREE.AmbientLight( 0xffffff, 0.75 ); // soft white light
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.25);
    directionalLight.position.set(0.5, -1, 0.5);
    scene.add(directionalLight);
  
    // load the model    
    loader = new GLTFLoader();               
    var source = 'assets/3d_models/maral_demo.glb';
    var model_ver_scale = 10;
    var model_hor_scale = 10;
    var model_alt_scale = 10;

    var marker = new google.maps.Marker({
      position: {
        lat: mapOptions.center.lat, 
        lng: mapOptions.center.lng,
      },
      map:map,
      title: "Click",
    });
    for(var c of cases[5]){
      new google.maps.Marker({
        position:{
          lat: c['Latitude'],
          lng: c['Longitude']
        },
        map:map,
        title: c['Identifier']
      })
    }

      const contentString = 
      '<p>Activity: ' + json_activity +'<p>'+
      '<p>Floor: '+ json_floor +'<p>' +
      '<p>Timestamp: '+ json_timestamp +'<p>'
      ;

    // const contentString = 
    // '<p>Activity:<p>'+
    // '<p>Floor: <p>'
    // '<p>Timestamp: <p>';
  
    const infowindow = new google.maps.InfoWindow({
      content: contentString,
    });

    marker.addListener("click", () => {
      infowindow.open({
        anchor: marker,
        map:map,
        shouldFocus: false,
      });
      map.setCenter(marker.getPosition());
    });

    var cylinder_radius = model_hor_scale+json_horizontal_acc;
    var cylinder_height = model_ver_scale+json_vertical_acc;
  
    var cylinder = new THREE.CylinderGeometry( cylinder_radius, cylinder_radius, cylinder_height, 36 );
    var cylinder_material = new THREE.MeshBasicMaterial( {
      color: 0x9fc5e8, 
      opacity: 0.6, 
      transparent: true
    } );
    const accuracy = new THREE.Mesh( cylinder, cylinder_material );
    accuracy.rotation.x = Math.PI/2;
    scene.add(accuracy);

    // var level = new THREE.PlaneGeometry(10,10)
    // var level_material = new THREE.MeshBasicMaterial({
    //   color:0xff0000,
    //   side:THREE.DoubleSide
    // })
    // const plane = new THREE.Mesh(level, level_material)
    // scene.add(plane)
    // plane.position.set(5, 0, 0)

    loader.load(
      source,
      gltf => {     
        gltf.scene.scale.set(model_hor_scale, model_ver_scale, model_alt_scale);
        gltf.scene.rotation.x = Math.PI/2; // rotations are in radians
        scene.add(gltf.scene);           
      }
    );
    // var line = new THREE.Curves( 20, 20, 40, 36 );
    // var line_material = new THREE.MeshBasicMaterial( {
    //   color: 0x9fc5e8, 
    //   opacity: 0.6,
    //   transparent: true
    // } );
    // const trace = new THREE.Line3(line, line_material);

  }
  
  webGLOverlayView.onContextRestored = ({gl}) => {    
    // create the three.js renderer, using the
    // maps's WebGL rendering context.
    renderer = new THREE.WebGLRenderer({
      canvas: gl.canvas,
      context: gl,
      ...gl.getContextAttributes(),
    });
    renderer.autoClear = false;

    // wait to move the camera until the 3D model loads    
    loader.manager.onLoad = () => {        
      renderer.setAnimationLoop(() => {
        map.moveCamera({
          "tilt": mapOptions.tilt,
          "heading": mapOptions.heading,
          "zoom": mapOptions.zoom
        });            
        
        // rotate the map 360 degrees 
        if (mapOptions.tilt < 67.5) {
          mapOptions.tilt += 0.5
        } else if (mapOptions.heading <= 360) {
          mapOptions.heading += 0.2;
        } else {
          renderer.setAnimationLoop(null)
        }
      });        
    }
  }

  webGLOverlayView.onDraw = ({gl, transformer}) => {
    // update camera matrix to ensure the model is georeferenced correctly on the map
    const latLngAltitudeLiteral = {
        lat: mapOptions.center.lat,
        lng: mapOptions.center.lng,
        altitude: json_altitude
        //altitude: 0
    }

    const matrix = transformer.fromLatLngAltitude(latLngAltitudeLiteral);
    camera.projectionMatrix = new THREE.Matrix4().fromArray(matrix);
    
    webGLOverlayView.requestRedraw();      
    renderer.render(scene, camera);                  

    // always reset the GL state
    renderer.resetState();
  }
  webGLOverlayView.setMap(map);
}

(async () => {        
  const map = await initMap();
  initWebGLOverlayView(map);

  console.log(cases);
  console.log(cases[0][0]["Latitude"]);

  //reading props
  const urlParams = new URLSearchParams(window.location.search);
  const caseValue = urlParams.get('case');
  var infos = []
  var scene = [...cases[caseValue]]
  scene = scene.sort(
    function(){
      if(a.Identifier > b.Identifier) return -1
      if(a.Identifier < b.Identifier) return 1
      if(a.Timestamp > b.Timestamp) return -1
      if(a.Timestamp < b.Timestamp) return 1
    }
  )
  for(var c in scene){
    var s = `<h1 id="firstHeading" class="firstHeading">${c.Identifier}</h1>` +
    `<p>Activity: ${c.Activity}</p>`+
    `<p>Floor label: ${c['Floor label']}</p>`
    if(scene.length > 0){
      var max_time = Math.max(...scene.map(p => p.Timestamp))
      s += `<p>Time: ${Math.round((max_time - c.Timestamp)/1000)} ago</p>`
    }
    infos.push(s)
  }

  const directionsService = new google.maps.DirectionsService();
  const directionsRenderer = new google.maps.DirectionsRenderer({
    preserveViewport: true,
    suppressMarkers: true
  });
  directionsRenderer.setMap(map);
  // directionsService.route({
  //     origin: {
  //       query: `${cases[5][0]['Latitude']} ${cases[5][0]['Longitude']}`,
  //     },
  //     destination: {
  //       query: `${cases[5][9]['Latitude']} ${cases[5][9]['Longitude']}`,
  //     },
  //     travelMode: google.maps.TravelMode.BICYCLING,
  //   })
  //   .then((response) => {
  //     console.log(response)
  //     directionsRenderer.setDirections(response);
  //   })
  if (directionsRenderer.getMap() == null)
        directionsRenderer.setMap(map);
  var stops = []
  for(var i = 1; i < cases[5].length-1; i++){
    stops.push({
      location:new google.maps.LatLng(cases[5][i]['Latitude'], cases[5][i]['Longitude']),
      stopover:true
    })
  }
  var request = {
    origin: 
    {
      query: `40.78017131, -73.96810659`,
    },
    destination: {
      query: `40.78047792, -73.96793906`,
    },
    travelMode: 'WALKING',
    waypoints:stops
  };

  directionsService.route(request, function(result, status) {
    if (status == 'OK') {
      console.log(result)
      directionsRenderer.setDirections(result);
    }
  });
  // install Tweenjs with npm i @tweenjs/tween.js
  new Tween(mapOptions) // Create a new tween that modifies 'cameraOptions'.
    .to({ tilt: 65, heading: 90, zoom: 18 }, 15000) // Move to destination in 15 second.
    .easing(Easing.Quadratic.Out) // Use an easing function to make the animation smooth.
    .onUpdate(() => {
      map.moveCamera(mapOptions);
    })
    .start(); // Start the tween immediately.

  // Setup the animation loop.
  function animate() {
    requestAnimationFrame(animate);
    update(time);
  }

  requestAnimationFrame(animate);
})()
var weatherLayer = new google.maps.weather.WeatherLayer({
  temperatureUnits: google.maps.weather.TemperatureUnit.FAHRENHEIT
});
weatherLayer.setMap(map);

var map;
var polyline;
var bounds;
var linePartArr = [];
var lineCoordinates = [
  { lat: cases[5][i]['Latitude'], lng: cases[5][i]['Longitude']},
];
//timeout because jquery script is loaded later that this js file on this page
setTimeout(function () {
    initializePolylineMap(52.52000, 5.28662);
}, 50);
 
//create the map
function initializePolylineMap(lat, lng) {
    //coord for the center of the map
    var startpos = new google.maps.LatLng(lat, lng);
 
    //map options
    var options = {
        zoom: 8,
        center: startpos,
        zoomControl: true,
        mapTypeControl: false,
        scaleControl: false,
        streetViewControl: false,
        rotateControl: false,
        fullscreenControl: false,
        mapTypeId: google.maps.MapTypeId.TERRAIN
    };
 
    //start the map
    map = new google.maps.Map(document.getElementById('map_canvas'), options);
 
    //add bounds
    bounds = new google.maps.LatLngBounds();
 
    //create the polyline
    createPolyLine();
 
    //animate the polyline drawing
    animatePolyline();
 
    //animate the icon
    animateIcon();
 
    //make an array of maps coordinates for the bounds
    for (var i = 0; i < lineCoordinates.length; i++) {
        var pos = new google.maps.LatLng(lineCoordinates[i].lat, lineCoordinates[i].lng);
        bounds.extend(pos);
    }
 
    //fit the map within the bounds
    map.fitBounds(bounds);
}
//add a polyline to the map
function createPolyLine() {
    //create a symbol to animate along the route
    var lineSymbol = {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 8,
        fillColor: '#566895',
        fillOpacity: 1,
        strokeColor: '#282c41',
        strokeOpacity: 1,
        strokeWeight: 2
    };
 
    //create a polyline
    polyline = new google.maps.Polyline({
        path: lineCoordinates,
        strokeColor: '#f39e9e',
        strokeWeight: 5,
        icons: [
            {
                icon: lineSymbol,
                offset: '100%'
            },
        ],
        map: map
    });
}
 
 
//animate the icon on the map
function animateIcon() {
    var lineOffset = 0;
 
    //experiment with the speed based on the length of the line
    var iconSpeed = 0.2;
 
    //move the icon
    setInterval(function () {
        lineOffset = (lineOffset + iconSpeed) % 200;
        var lineIcon = polyline.get('icons');
        lineIcon[0].offset = lineOffset / 2 + '%';
        polyline.set('icons', lineIcon);
    }, 20);
}
 
 
//animate the drawing of the polyline
function animatePolyline() {
    var i = 0;
    var pause = false;
    var pauseLineRemove = 1500;
    var pauseRedrawLine = 1000;
 
    //experiment with the speed based on the total parts in the line
    var drawSpeed = 50;
 
    setInterval(function () {
 
        //check if the end of the array is reached
        if (i + 1 == lineCoordinates.length && !pause) {
            pause = true;
 
            //remove all the line parts, optionally with a delay to keep the fully drawn line on the map for a while
            setTimeout(function () {
                for (var j = 0; j < linePartArr.length; j++) {
                    linePartArr[j].setMap(null);
                }
 
                linePartArr = [];
            }, pauseLineRemove);
 
            //delay the drawing of the next animated line
            setTimeout(function () {
                pause = false;
                i = 0;
            }, pauseRedrawLine + pauseLineRemove);
        }
 
        //create a line part between the current and next coordinate
        if (!pause) {
            var part = [];
            part.push(lineCoordinates[i]);
            part.push(lineCoordinates[i + 1]);
 
            //create a polyline
            var linePart = new google.maps.Polyline({
                path: part,
                strokeColor: '#ff0000',
                strokeOpacity: 1,
                strokeWeight: 5,
                zIndex: i + 2,
                map: map
            });
 
            //add the polyline to an array
            linePartArr.push(linePart);
 
            i++;
        }
 
    }, drawSpeed);
}