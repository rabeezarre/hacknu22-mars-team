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
import {TextGeometry} from 'three'
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
  var accuracy;

  //json properties
  var json_latitude = cases[caseValue][sizeOfCase-1]["Latitude"];
  var json_longitude = cases[caseValue][sizeOfCase-1]["Longitude"];
  var json_vertical_acc = cases[caseValue][sizeOfCase-1]["Vertical accuracy"];
  var json_horizontal_acc = cases[caseValue][sizeOfCase-1]["Horizontal accuracy"];
  var json_altitude = cases[caseValue][sizeOfCase-1]["Altitude"];
  var json_conf_acc = cases[caseValue][sizeOfCase-1]["Confidence in location accuracy"];
  var json_floor = cases[caseValue][sizeOfCase-1]["Floor label"];

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
    accuracy = new THREE.Mesh( cylinder, cylinder_material );
    accuracy.rotation.x = Math.PI/2;
    scene.add(accuracy);

    // load the floors
    const material = new THREE.LineBasicMaterial({
        color: 0x0000ff,
        linewidth: 1
    });
    const points = [];
    points.push( new THREE.Vector3( 0, 0, -10 ) );
    points.push( new THREE.Vector3( 0, 0, -json_altitude ) );
    const geometry = new THREE.BufferGeometry().setFromPoints( points );
    const line = new THREE.Line( geometry, material );
    scene.add( line );


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

        accuracy.cylinder_radius = 3000;

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


function moveCameraUp() {
    console.log("moveCameraUp");
    map.moveCamera({
        "tilt": 0,
        "heading": 0,
        "zoom": 20
      }); 
}

function moveCameraSide(){
    map.moveCamera({
        "tilt": 90,
        "heading": 0,
        "zoom": 20
      }); 
}

(async () => {

  const urlParams = new URLSearchParams(window.location.search);
  const caseValue = urlParams.get('case');

  const map = await initMap(caseValue-1);
  initWebGLOverlayView(map, caseValue-1);

  //reading props
  
  // var infos = []
  // var scene = [...cases[caseValue]]
  // scene = scene.sort(
  //   function(){
  //     if(a.Identifier > b.Identifier) return -1
  //     if(a.Identifier < b.Identifier) return 1
  //     if(a.Timestamp > b.Timestamp) return -1
  //     if(a.Timestamp < b.Timestamp) return 1
  //   }
  // )
  // for(var c in scene){
  //   var s = `<h1 id="firstHeading" class="firstHeading">${c.Identifier}</h1>` +
  //   `<p>Activity: ${c.Activity}</p>`+
  //   `<p>Floor label: ${c['Floor label']}</p>`
  //   if(scene.length > 0){
  //     var max_time = Math.max(...scene.map(p => p.Timestamp))
  //     s += `<p>Time: ${Math.round((max_time - c.Timestamp)/1000)} ago</p>`
  //   }
  //   infos.push(s)
  // }
})();