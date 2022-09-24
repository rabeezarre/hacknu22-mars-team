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

const apiOptions = {
  apiKey: 'AIzaSyB7_iUwIzCFUVNtXtBU5XyrlwtYHy6vwUM',
  version: "beta"
};

async function initMap(caseValue) {    
  const mapDiv = document.getElementById("map");
  const apiLoader = new Loader(apiOptions);
  await apiLoader.load();

  var sizeOfCase = cases[caseValue].length;

  var lat = cases[caseValue][sizeOfCase-1]["Latitude"];
  var lng = cases[caseValue][sizeOfCase-1]["Longitude"];

  return new google.maps.Map(mapDiv, {
    "tilt": 0,
    "heading": 0,
    "zoom": 18,
    "center": { lat, lng },
    "mapId": "9221e2194dfa8f5e"
  });
}

function initWebGLOverlayView(map, caseValue) {  
  let scene, renderer, camera, loader;
  const webGLOverlayView = new google.maps.WebGLOverlayView();
  var sizeOfCase = cases[caseValue].length;
  loader = new GLTFLoader();

  //json properties
  var json_latitude = cases[caseValue][sizeOfCase-1]["Latitude"];
  var json_longitude = cases[caseValue][sizeOfCase-1]["Longitude"];
  var json_vertical_acc = cases[caseValue][sizeOfCase-1]["Vertical accuracy"];
  var json_horizontal_acc = cases[caseValue][sizeOfCase-1]["Horizontal accuracy"];
  var json_altitude = cases[caseValue][sizeOfCase-1]["Altitude"];
  var json_conf_acc = cases[caseValue][sizeOfCase-1]["Confidence in location accuracy"];

  const mapOptions = {
    "tilt": 0,
    "heading": 0,
    "zoom": 18,
    "center": { lat: json_latitude, lng: json_longitude },
    "mapId": "9221e2194dfa8f5e"
  }

  webGLOverlayView.onAdd = () => {   
    // set up the scene
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera();
    const ambientLight = new THREE.AmbientLight( 0xffffff, 0.75 ); // soft white light
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.25);
    directionalLight.position.set(0.5, -1, 0.5);
    scene.add(directionalLight);
  

    // load the accuracy cylinder
    var cylinder_radius = Math.trunc(10 + json_horizontal_acc*10);
    var cylinder_height = Math.trunc(10 + json_vertical_acc*10);
    var cylinder = new THREE.CylinderGeometry(cylinder_radius, cylinder_radius, cylinder_height, 36);
    var cylinder_material = new THREE.MeshBasicMaterial( {
      color: 0x9fc5e8, 
      opacity: json_conf_acc, 
      transparent: true
    } );
    const accuracy = new THREE.Mesh( cylinder, cylinder_material );
    accuracy.rotation.x = Math.PI/2;
    scene.add(accuracy);

    // load the model
    var source = 'assets/3d_models/maral_demo.glb';
    loader.load(
      source,
      gltf => {     
        gltf.scene.scale.set(10,10,10);
        gltf.scene.rotation.x = Math.PI/2; // rotations are in radians
        scene.add(gltf.scene);           
      }
    );
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

  const urlParams = new URLSearchParams(window.location.search);
  const caseValue = urlParams.get('case');

  const map = await initMap(caseValue-1);
  initWebGLOverlayView(map, caseValue-1);

  var points = [...cases[caseValue-1]]
  points = points.sort(
    function(a,b){
      if(a.Identifier > b.Identifier) return -1
      if(a.Identifier < b.Identifier) return 1
      if(a.Timestamp > b.Timestamp) return 1
      if(a.Timestamp < b.Timestamp) return -1
    }
  )
  var traces = new Map()
  for(var p of points){
    var identif = p.Identifier !== "null" ? p.Identifier : '?'
    if(!traces.has(identif)){
      traces.set(identif, [p])
    } else {
      traces.get(identif).push(p)
    }
  }

<<<<<<< HEAD
  for(const person of traces.keys()){
    var color = Math.floor(Math.random()*16777215).toString(16)
    var lastTime = traces.get(person)[traces.get(person).length-1]['Timestamp']
    console.log(lastTime)
    traces.get(person).forEach(function(point){
        var marker = new google.maps.Marker({
          position:{lat:point['Latitude'], lng:point['Longitude']},
          map,
          title:person
        })
        var contentString = `
          <h3>Identifier: ${point['Identifier']}</h3>
          <p>Activity: ${point['Activity']}</p>
        `
        contentString += point['Floor label'] !== 'null' ? `<p>Floor label: ${point['Floor label']}</p>` : ''
        contentString += `<p>Measured ${(Math.round(lastTime - point['Timestamp'])/1000)} seconds ago</p>`
        const infowindow = new google.maps.InfoWindow({
          content: contentString,
        });
      
        marker.addListener("click", () => {
          infowindow.open({
            anchor: marker,
            map,
            shouldFocus: false,
          });
        });
      }
    )
    if(traces.get(person).length > 1){
      var directionsService = new google.maps.DirectionsService();
      var directionsRenderer = new google.maps.DirectionsRenderer({
        polylineOptions: {
          strokeColor: `#${color}`,
          strokeOpacity:0.8,
          geodesic:true
        },
        suppressMarkers: true
      });
      directionsRenderer.setMap(map);
      var mode = traces.get(person)[0]['Activity']
      if(mode === 'UNKNOWN' || mode === 'running' || mode === 'walking'){
        mode = 'WALKING'
      } else if (mode === 'cycling'){
        mode = 'BICYCLING'
      } else {
        mode = 'DRIVING'
      }
      var wpoints = traces.get(person).length > 2  ? traces.get(person).slice(1, traces.get(person).length) : []
      var wpoints = []
      if(traces.get(person).length > 2){
        for(var w of traces.get(person).slice(1, traces.get(person).length-1))
        wpoints.push({
          location: new google.maps.LatLng(w['Latitude'], w['Longitude']),
          stopover:true
        })
      }
      var request = {
        origin: {
          query: `${traces.get(person)[0]['Latitude']} ${traces.get(person)[0]['Longitude']}`
        },
        destination: {
          query: `${traces.get(person)[traces.get(person).length-1]['Latitude']} ${traces.get(person)[traces.get(person).length-1]['Longitude']}`
        },
        travelMode: mode,
        waypoints: wpoints
      };
      directionsService.route(request, function(result, status) {
        console.log(result)
        if (status == 'OK') {
          directionsRenderer.setDirections(result);
        }
      });
    }
  }
})();
=======
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
>>>>>>> f11150a (Menu)
