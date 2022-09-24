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