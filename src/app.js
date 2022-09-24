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

const mapOptions = {
  "tilt": 0,
  "heading": 0,
  "zoom": 18,
  "center": { lat: 35.66093428, lng: 139.7290334 },
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
    const source = 'assets/3d_models/maral_demo.glb';

    const geometry = new THREE.CylinderGeometry( 20, 20, 40, 36 );
    const material = new THREE.MeshBasicMaterial( {
      color: 0x9fc5e8, 
      opacity: 0.6, 
      transparent: true
    } );
  
    const accuracy = new THREE.Mesh( geometry, material );
    accuracy.rotation.x = Math.PI/2;

    const level = new THREE.PlaneGeometry(1,1)
    const level_material = new THREE.MeshBasicMaterial( {color: 0xff0000, side: THREE.DoubleSide} );
    const plane = new THREE.Mesh( level, level_material );

    scene.add(accuracy);
    scene.add(plane)
    loader.load(
      source,
      gltf => {     
        gltf.scene.scale.set(25,25,25);
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
        altitude: 0
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

  //reading props
  const urlParams = new URLSearchParams(window.location.search);
  const caseValue = urlParams.get('case');
  var infos = []
  var scene = [...cases[caseValue-1]]
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
    if(scene.length > 1){
      console.log
      var max_time = Math.max(...scene.map(p => p.Timestamp))
      s += `<p>Time: ${Math.round((max_time - c.Timestamp)/1000)} ago</p>`
    }
    infos.push(s)
  }
})()