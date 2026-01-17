// Room.xyz - 3D Pixelated Room Generator
let scene, camera, renderer, controls;
let roomObjects = [];
let selectedObject = null;
let roomData = [];
let uploadedImage = null;
let wireframeMode = false;

// Initialize Three.js scene
function initScene() {
    const container = document.getElementById('canvas-container');
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);
    scene.fog = new THREE.Fog(0x87CEEB, 10, 50);

    // Camera
    camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    camera.position.set(8, 8, 8);
    camera.lookAt(0, 0, 0);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // Controls
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 5;
    controls.maxDistance = 20;

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 20, 10);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);

    // Point lights for atmosphere
    const pointLight1 = new THREE.PointLight(0xffaa88, 0.5);
    pointLight1.position.set(-5, 3, 5);
    scene.add(pointLight1);

    const pointLight2 = new THREE.PointLight(0x88aaff, 0.5);
    pointLight2.position.set(5, 3, -5);
    scene.add(pointLight2);

    // Add room floor and walls
    createRoom();

    // Mouse interaction
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    renderer.domElement.addEventListener('click', (event) => {
        const rect = renderer.domElement.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(roomObjects, true);

        if (intersects.length > 0) {
            selectObject(intersects[0].object.parent || intersects[0].object);
        } else {
            deselectObject();
        }
    });

    // Handle window resize
    window.addEventListener('resize', () => {
        const width = container.clientWidth;
        const height = container.clientHeight;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
    });

    animate();
}

function createRoom() {
    // Floor
    const floorGeometry = new THREE.BoxGeometry(10, 0.2, 10);
    const floorMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xD4A574,
        roughness: 0.8,
        metalness: 0.2
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.position.y = -0.1;
    floor.receiveShadow = true;
    scene.add(floor);

    // Back wall
    const wallMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xF5F5F5,
        roughness: 0.9,
        side: THREE.DoubleSide
    });
    
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(10, 6, 0.2), wallMaterial);
    backWall.position.set(0, 3, -5);
    backWall.receiveShadow = true;
    scene.add(backWall);

    // Left wall
    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.2, 6, 10), wallMaterial);
    leftWall.position.set(-5, 3, 0);
    leftWall.receiveShadow = true;
    scene.add(leftWall);

    // Right wall (partial for visibility)
    const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.2, 6, 10), wallMaterial);
    rightWall.position.set(5, 3, 0);
    rightWall.receiveShadow = true;
    rightWall.material.transparent = true;
    rightWall.material.opacity = 0.3;
    scene.add(rightWall);
}

// Create voxel-style furniture
function createVoxelObject(type, data) {
    const group = new THREE.Group();
    group.userData = { type, data };
    
    const color = new THREE.Color(data.color);
    const material = new THREE.MeshStandardMaterial({ 
        color: color,
        roughness: 0.7,
        metalness: 0.3
    });

    // Scale factor
    const scale = 10; // Room scale

    switch(type) {
        case 'desk':
            // Desktop
            const desktopGeom = new THREE.BoxGeometry(
                data.dimensions.width * scale,
                data.dimensions.height * scale * 0.2,
                data.dimensions.depth * scale
            );
            const desktop = new THREE.Mesh(desktopGeom, material);
            desktop.position.y = data.dimensions.height * scale * 0.5;
            desktop.castShadow = true;
            group.add(desktop);

            // Legs (4 corners)
            const legMaterial = new THREE.MeshStandardMaterial({ color: 0x8B6F47 });
            const legGeom = new THREE.BoxGeometry(0.2, data.dimensions.height * scale * 0.8, 0.2);
            
            for(let x = -1; x <= 1; x += 2) {
                for(let z = -1; z <= 1; z += 2) {
                    const leg = new THREE.Mesh(legGeom, legMaterial);
                    leg.position.set(
                        x * (data.dimensions.width * scale * 0.4),
                        data.dimensions.height * scale * 0.4,
                        z * (data.dimensions.depth * scale * 0.4)
                    );
                    leg.castShadow = true;
                    group.add(leg);
                }
            }
            break;

        case 'chair':
            // Seat
            const seatGeom = new THREE.BoxGeometry(
                data.dimensions.width * scale * 0.8,
                data.dimensions.height * scale * 0.15,
                data.dimensions.depth * scale * 0.8
            );
            const seat = new THREE.Mesh(seatGeom, material);
            seat.position.y = data.dimensions.height * scale * 0.4;
            seat.castShadow = true;
            group.add(seat);

            // Backrest
            const backrestGeom = new THREE.BoxGeometry(
                data.dimensions.width * scale * 0.8,
                data.dimensions.height * scale * 0.5,
                data.dimensions.depth * scale * 0.1
            );
            const backrest = new THREE.Mesh(backrestGeom, material);
            backrest.position.set(
                0,
                data.dimensions.height * scale * 0.65,
                -data.dimensions.depth * scale * 0.35
            );
            backrest.castShadow = true;
            group.add(backrest);

            // Legs
            const chairLegGeom = new THREE.BoxGeometry(0.15, data.dimensions.height * scale * 0.4, 0.15);
            for(let x = -1; x <= 1; x += 2) {
                for(let z = -1; z <= 1; z += 2) {
                    const leg = new THREE.Mesh(chairLegGeom, material);
                    leg.position.set(
                        x * (data.dimensions.width * scale * 0.3),
                        data.dimensions.height * scale * 0.2,
                        z * (data.dimensions.depth * scale * 0.3)
                    );
                    leg.castShadow = true;
                    group.add(leg);
                }
            }
            break;

        case 'bed':
            // Mattress
            const mattressGeom = new THREE.BoxGeometry(
                data.dimensions.width * scale,
                data.dimensions.height * scale * 0.3,
                data.dimensions.depth * scale
            );
            const mattress = new THREE.Mesh(mattressGeom, material);
            mattress.position.y = data.dimensions.height * scale * 0.5;
            mattress.castShadow = true;
            group.add(mattress);

            // Base
            const baseGeom = new THREE.BoxGeometry(
                data.dimensions.width * scale,
                data.dimensions.height * scale * 0.2,
                data.dimensions.depth * scale
            );
            const baseMaterial = new THREE.MeshStandardMaterial({ 
                color: new THREE.Color(color).multiplyScalar(0.7)
            });
            const base = new THREE.Mesh(baseGeom, baseMaterial);
            base.position.y = data.dimensions.height * scale * 0.25;
            base.castShadow = true;
            group.add(base);
            break;

        case 'monitor':
            // Screen
            const screenGeom = new THREE.BoxGeometry(
                data.dimensions.width * scale,
                data.dimensions.height * scale * 0.7,
                data.dimensions.depth * scale * 0.3
            );
            const screen = new THREE.Mesh(screenGeom, material);
            screen.position.y = data.dimensions.height * scale * 0.6;
            screen.castShadow = true;
            group.add(screen);

            // Display (glowing)
            const displayGeom = new THREE.BoxGeometry(
                data.dimensions.width * scale * 0.9,
                data.dimensions.height * scale * 0.6,
                0.05
            );
            const displayMaterial = new THREE.MeshBasicMaterial({ 
                color: 0x44FF88,
                emissive: 0x44FF88,
                emissiveIntensity: 0.5
            });
            const display = new THREE.Mesh(displayGeom, displayMaterial);
            display.position.set(0, data.dimensions.height * scale * 0.6, data.dimensions.depth * scale * 0.16);
            group.add(display);

            // Stand
            const standGeom = new THREE.BoxGeometry(0.3, data.dimensions.height * scale * 0.3, 0.3);
            const stand = new THREE.Mesh(standGeom, material);
            stand.position.y = data.dimensions.height * scale * 0.2;
            stand.castShadow = true;
            group.add(stand);
            break;

        case 'keyboard':
            const keyboardGeom = new THREE.BoxGeometry(
                data.dimensions.width * scale,
                data.dimensions.height * scale,
                data.dimensions.depth * scale
            );
            const keyboard = new THREE.Mesh(keyboardGeom, material);
            keyboard.position.y = data.dimensions.height * scale * 0.5;
            keyboard.castShadow = true;
            group.add(keyboard);

            // Add keys texture
            const keysGeom = new THREE.BoxGeometry(
                data.dimensions.width * scale * 0.9,
                0.1,
                data.dimensions.depth * scale * 0.9
            );
            const keysMaterial = new THREE.MeshStandardMaterial({ 
                color: 0x333333,
                roughness: 0.5
            });
            const keys = new THREE.Mesh(keysGeom, keysMaterial);
            keys.position.y = data.dimensions.height * scale * 0.55;
            group.add(keys);
            break;

        case 'plant':
            // Pot
            const potGeom = new THREE.CylinderGeometry(
                data.dimensions.width * scale * 0.4,
                data.dimensions.width * scale * 0.3,
                data.dimensions.height * scale * 0.3,
                8
            );
            const potMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
            const pot = new THREE.Mesh(potGeom, potMaterial);
            pot.position.y = data.dimensions.height * scale * 0.15;
            pot.castShadow = true;
            group.add(pot);

            // Leaves (voxel style)
            const leafMaterial = new THREE.MeshStandardMaterial({ color: color });
            for(let i = 0; i < 5; i++) {
                const leafGeom = new THREE.BoxGeometry(0.3, 0.3, 0.3);
                const leaf = new THREE.Mesh(leafGeom, leafMaterial);
                const angle = (Math.PI * 2 * i) / 5;
                const radius = data.dimensions.width * scale * 0.3;
                leaf.position.set(
                    Math.cos(angle) * radius,
                    data.dimensions.height * scale * 0.5 + Math.random() * 0.5,
                    Math.sin(angle) * radius
                );
                leaf.rotation.set(
                    Math.random() * 0.5,
                    Math.random() * Math.PI * 2,
                    Math.random() * 0.5
                );
                leaf.castShadow = true;
                group.add(leaf);
            }
            break;

        case 'lamp':
            // Base
            const baseGeom2 = new THREE.CylinderGeometry(
                data.dimensions.width * scale * 0.5,
                data.dimensions.width * scale * 0.6,
                data.dimensions.height * scale * 0.15,
                8
            );
            const lampBase = new THREE.Mesh(baseGeom2, material);
            lampBase.position.y = data.dimensions.height * scale * 0.075;
            lampBase.castShadow = true;
            group.add(lampBase);

            // Pole
            const poleGeom = new THREE.CylinderGeometry(0.1, 0.1, data.dimensions.height * scale * 0.6, 8);
            const pole = new THREE.Mesh(poleGeom, material);
            pole.position.y = data.dimensions.height * scale * 0.45;
            pole.castShadow = true;
            group.add(pole);

            // Shade
            const shadeGeom = new THREE.CylinderGeometry(
                data.dimensions.width * scale * 0.8,
                data.dimensions.width * scale * 0.5,
                data.dimensions.height * scale * 0.25,
                8
            );
            const shadeMaterial = new THREE.MeshStandardMaterial({ 
                color: 0xFFF8DC,
                emissive: 0xFFDD88,
                emissiveIntensity: 0.3
            });
            const shade = new THREE.Mesh(shadeGeom, shadeMaterial);
            shade.position.y = data.dimensions.height * scale * 0.875;
            shade.castShadow = true;
            group.add(shade);

            // Add point light
            const lampLight = new THREE.PointLight(0xFFDD88, 0.5, 3);
            lampLight.position.y = data.dimensions.height * scale * 0.8;
            group.add(lampLight);
            break;

        case 'shelf':
            const shelfGeom = new THREE.BoxGeometry(
                data.dimensions.width * scale,
                data.dimensions.height * scale,
                data.dimensions.depth * scale
            );
            const shelf = new THREE.Mesh(shelfGeom, material);
            shelf.position.y = data.dimensions.height * scale * 0.5;
            shelf.castShadow = true;
            group.add(shelf);
            break;

        case 'rug':
            const rugGeom = new THREE.BoxGeometry(
                data.dimensions.width * scale,
                data.dimensions.height * scale,
                data.dimensions.depth * scale
            );
            const rug = new THREE.Mesh(rugGeom, material);
            rug.position.y = 0.05;
            rug.receiveShadow = true;
            group.add(rug);
            break;

        case 'picture_frame':
            // Frame on floor (like a standing frame)
            const frameGeom = new THREE.BoxGeometry(
                data.dimensions.width * scale,
                data.dimensions.height * scale,
                data.dimensions.depth * scale
            );
            const frameMaterial = new THREE.MeshStandardMaterial({ 
                color: new THREE.Color(color).multiplyScalar(0.6)
            });
            const frame = new THREE.Mesh(frameGeom, frameMaterial);
            frame.position.y = data.dimensions.height * scale * 0.5;
            frame.castShadow = true;
            group.add(frame);

            // Picture surface
            const pictureGeom = new THREE.BoxGeometry(
                data.dimensions.width * scale * 0.8,
                data.dimensions.height * scale * 0.8,
                0.05
            );
            const pictureMaterial = new THREE.MeshStandardMaterial({ 
                color: new THREE.Color(color).multiplyScalar(1.2)
            });
            const picture = new THREE.Mesh(pictureGeom, pictureMaterial);
            picture.position.set(0, data.dimensions.height * scale * 0.5, data.dimensions.depth * scale * 0.51);
            group.add(picture);
            break;

        case 'curtain':
            // Floor-standing curtain/divider
            const curtainGeom = new THREE.BoxGeometry(
                data.dimensions.width * scale,
                data.dimensions.height * scale,
                data.dimensions.depth * scale
            );
            
            const curtain = new THREE.Mesh(curtainGeom, material);
            curtain.position.y = data.dimensions.height * scale * 0.5;
            curtain.castShadow = true;
            group.add(curtain);
            break;

        case 'sofa':
            // Seat
            const sofaSeatGeom = new THREE.BoxGeometry(
                data.dimensions.width * scale,
                data.dimensions.height * scale * 0.25,
                data.dimensions.depth * scale * 0.7
            );
            const sofaSeat = new THREE.Mesh(sofaSeatGeom, material);
            sofaSeat.position.y = data.dimensions.height * scale * 0.3;
            sofaSeat.castShadow = true;
            group.add(sofaSeat);

            // Backrest
            const sofaBackGeom = new THREE.BoxGeometry(
                data.dimensions.width * scale,
                data.dimensions.height * scale * 0.5,
                data.dimensions.depth * scale * 0.15
            );
            const sofaBack = new THREE.Mesh(sofaBackGeom, material);
            sofaBack.position.set(0, data.dimensions.height * scale * 0.55, -data.dimensions.depth * scale * 0.27);
            sofaBack.castShadow = true;
            group.add(sofaBack);

            // Arms
            const armGeom = new THREE.BoxGeometry(
                data.dimensions.width * scale * 0.1,
                data.dimensions.height * scale * 0.4,
                data.dimensions.depth * scale * 0.7
            );
            const leftArm = new THREE.Mesh(armGeom, material);
            leftArm.position.set(-data.dimensions.width * scale * 0.45, data.dimensions.height * scale * 0.45, 0);
            leftArm.castShadow = true;
            group.add(leftArm);

            const rightArm = new THREE.Mesh(armGeom, material);
            rightArm.position.set(data.dimensions.width * scale * 0.45, data.dimensions.height * scale * 0.45, 0);
            rightArm.castShadow = true;
            group.add(rightArm);
            break;

        case 'bookshelf':
            // Main structure
            const bookshelfGeom = new THREE.BoxGeometry(
                data.dimensions.width * scale,
                data.dimensions.height * scale,
                data.dimensions.depth * scale
            );
            const bookshelf = new THREE.Mesh(bookshelfGeom, material);
            bookshelf.position.y = data.dimensions.height * scale * 0.5;
            bookshelf.castShadow = true;
            group.add(bookshelf);

            // Shelves (horizontal dividers)
            const shelfDividerGeom = new THREE.BoxGeometry(
                data.dimensions.width * scale * 0.95,
                0.1,
                data.dimensions.depth * scale * 0.9
            );
            const dividerMaterial = new THREE.MeshStandardMaterial({ 
                color: new THREE.Color(color).multiplyScalar(0.8)
            });
            
            for (let i = 1; i < 4; i++) {
                const divider = new THREE.Mesh(shelfDividerGeom, dividerMaterial);
                divider.position.y = (data.dimensions.height * scale / 4) * i;
                divider.castShadow = true;
                group.add(divider);
            }
            break;

        case 'side_table':
            // Tabletop
            const sideTableTopGeom = new THREE.BoxGeometry(
                data.dimensions.width * scale,
                data.dimensions.height * scale * 0.15,
                data.dimensions.depth * scale
            );
            const tableTop = new THREE.Mesh(sideTableTopGeom, material);
            tableTop.position.y = data.dimensions.height * scale * 0.9;
            tableTop.castShadow = true;
            group.add(tableTop);

            // Legs
            const sideTableLegGeom = new THREE.BoxGeometry(0.15, data.dimensions.height * scale * 0.85, 0.15);
            for(let x = -1; x <= 1; x += 2) {
                for(let z = -1; z <= 1; z += 2) {
                    const leg = new THREE.Mesh(sideTableLegGeom, material);
                    leg.position.set(
                        x * (data.dimensions.width * scale * 0.4),
                        data.dimensions.height * scale * 0.425,
                        z * (data.dimensions.depth * scale * 0.4)
                    );
                    leg.castShadow = true;
                    group.add(leg);
                }
            }
            break;

        default:
            // Generic box for other objects
            const genericGeom = new THREE.BoxGeometry(
                data.dimensions.width * scale,
                data.dimensions.height * scale,
                data.dimensions.depth * scale
            );
            const genericMesh = new THREE.Mesh(genericGeom, material);
            genericMesh.position.y = data.dimensions.height * scale * 0.5;
            genericMesh.castShadow = true;
            group.add(genericMesh);
            break;
    }

    return group;
}

function positionObject(object, posData, objectData, groupOffset = {x: 0, z: 0}) {
    const scale = 10;
    
    // Convert position strings to actual coordinates
    let x = 0, z = 0;
    
    // X-axis positioning (left to right)
    if (posData.x === 'left') {
        x = -scale * 0.35;
    } else if (posData.x === 'right') {
        x = scale * 0.35;
    } else { // center
        x = 0;
    }
    
    // Z-axis positioning (front to back)
    if (posData.z === 'front') {
        z = scale * 0.35;
    } else if (posData.z === 'back') {
        z = -scale * 0.35;
    } else { // middle
        z = 0;
    }
    
    // Add group offset for multiple items in same zone
    x += groupOffset.x;
    z += groupOffset.z;
    
    // Set position (Y will be adjusted after)
    object.position.set(x, 0, z);
    
    // Force update the object's matrix
    object.updateMatrixWorld(true);
    
    // Calculate bounding box and align to floor
    const box = new THREE.Box3().setFromObject(object);
    const minY = box.min.y;
    
    // Lift object so its bottom is at y=0 (floor level)
    object.position.y = -minY + 0.01;
}

function generateRoom(data) {
    // Clear existing objects
    roomObjects.forEach(obj => {
        scene.remove(obj);
    });
    roomObjects = [];
    roomData = data;

    // Group objects by position to handle placement better
    const positionGroups = {};
    
    // Initialize all position combinations
    ['left', 'center', 'right'].forEach(x => {
        ['front', 'middle', 'back'].forEach(z => {
            positionGroups[`${x}-${z}`] = [];
        });
    });

    // Group objects by their positions
    data.forEach((item, index) => {
        const key = `${item.position.x}-${item.position.z}`;
        if (positionGroups[key]) {
            positionGroups[key].push({ item, index });
        }
    });

    // Create and position objects with better spacing
    data.forEach((item, index) => {
        const obj = createVoxelObject(item.type, item);
        
        // Get the position group for offset calculation
        const groupKey = `${item.position.x}-${item.position.z}`;
        const group = positionGroups[groupKey] || [];
        const indexInGroup = group.findIndex(g => g.index === index);
        
        // Calculate group offset for multiple items in same zone
        let groupOffset = {x: 0, z: 0};
        if (group.length > 1 && indexInGroup >= 0) {
            // Spread items in a line pattern
            const totalItems = group.length;
            const spacing = 1.5;
            groupOffset.x = (indexInGroup - (totalItems - 1) / 2) * spacing;
        }
        
        // Apply positioning
        positionObject(obj, item.position, item, groupOffset);
        
        obj.userData.index = index;
        obj.userData.selectable = true;
        scene.add(obj);
        roomObjects.push(obj);
    });

    updateObjectList();
}

function updateObjectList() {
    const list = document.getElementById('objectList');
    list.innerHTML = '';

    roomData.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'object-item';
        div.innerHTML = `
            <h3>${item.type.replace('_', ' ')}</h3>
            <div>Size: ${item.size}</div>
            <div class="color-indicator" style="background-color: ${item.color}"></div>
        `;
        div.onclick = () => {
            const obj = roomObjects[index];
            if (obj) selectObject(obj);
        };
        list.appendChild(div);
    });
}

function selectObject(obj) {
    // Find the root group object
    while(obj.parent && obj.parent !== scene) {
        obj = obj.parent;
    }

    if (!obj.userData.selectable) return;

    deselectObject();
    
    selectedObject = obj;
    
    // Add selection outline
    selectedObject.traverse((child) => {
        if (child.isMesh && child.material) {
            child.userData.originalEmissive = child.material.emissive ? child.material.emissive.clone() : new THREE.Color(0x000000);
            child.userData.originalEmissiveIntensity = child.material.emissiveIntensity || 0;
            child.material.emissive = new THREE.Color(0xFFFF00);
            child.material.emissiveIntensity = 0.5;
        }
    });

    // Highlight in list
    const items = document.querySelectorAll('.object-item');
    items[obj.userData.index]?.classList.add('selected');

    // Show info
    const info = document.getElementById('selected-info');
    const data = obj.userData.data;
    info.innerHTML = `
        <h3>Selected: ${obj.userData.type}</h3>
        <div>Position: ${data.position.x}, ${data.position.z}</div>
        <div>Size: ${data.size}</div>
        <div>Color: ${data.color}</div>
        <button class="btn" style="margin-top: 10px; padding: 8px 15px; font-size: 0.9em;" 
                onclick="deleteSelectedObject()">🗑️ Delete</button>
    `;
    info.style.display = 'block';
}

function deselectObject() {
    if (selectedObject) {
        selectedObject.traverse((child) => {
            if (child.isMesh && child.material && child.userData.originalEmissive) {
                child.material.emissive = child.userData.originalEmissive;
                child.material.emissiveIntensity = child.userData.originalEmissiveIntensity;
            }
        });
        selectedObject = null;
    }

    document.querySelectorAll('.object-item').forEach(item => {
        item.classList.remove('selected');
    });

    document.getElementById('selected-info').style.display = 'none';
}

function deleteSelectedObject() {
    if (selectedObject) {
        const index = selectedObject.userData.index;
        scene.remove(selectedObject);
        roomObjects.splice(index, 1);
        roomData.splice(index, 1);
        
        // Update indices
        roomObjects.forEach((obj, i) => {
            obj.userData.index = i;
        });
        
        deselectObject();
        updateObjectList();
    }
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

// File upload handling
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const generateBtn = document.getElementById('generateBtn');
const loader = document.getElementById('loader');
const previewImg = document.getElementById('previewImg');

uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
});

uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('dragover');
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleFile(files[0]);
    }
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handleFile(e.target.files[0]);
    }
});

function handleFile(file) {
    if (!file.type.startsWith('image/')) {
        alert('Please upload an image file');
        return;
    }

    uploadedImage = file;
    generateBtn.disabled = false;

    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => {
        previewImg.src = e.target.result;
        previewImg.style.display = 'block';
    };
    reader.readAsDataURL(file);
}

generateBtn.addEventListener('click', async () => {
    if (!uploadedImage) return;

    loader.style.display = 'block';
    generateBtn.disabled = true;

    const formData = new FormData();
    formData.append('image', uploadedImage);

    try {
        const response = await fetch('http://localhost:3000/api/analyze-room', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();
        
        if (result.success && result.roomData) {
            generateRoom(result.roomData);
            document.getElementById('reloadSceneBtn').style.display = 'inline-block';
        } else if (result.fallbackData) {
            console.warn('Using fallback data');
            generateRoom(result.fallbackData);
            document.getElementById('reloadSceneBtn').style.display = 'inline-block';
        } else {
            throw new Error('Failed to generate room data');
        }

    } catch (error) {
        console.error('Error:', error);
        alert('Error analyzing image. Using sample room instead.');
        // Generate sample room
        generateRoom([
            {
                "type": "desk",
                "position": {"x": "center", "z": "back"},
                "size": "large",
                "color": "#FFFFFF",
                "dimensions": {"width": 0.4, "height": 0.15, "depth": 0.3}
            },
            {
                "type": "chair",
                "position": {"x": "center", "z": "middle"},
                "size": "medium",
                "color": "#FF6B9D",
                "dimensions": {"width": 0.15, "height": 0.2, "depth": 0.15}
            },
            {
                "type": "monitor",
                "position": {"x": "center", "z": "back"},
                "size": "medium",
                "color": "#2C3E50",
                "dimensions": {"width": 0.2, "height": 0.15, "depth": 0.05}
            }
        ]);
        document.getElementById('reloadSceneBtn').style.display = 'inline-block';
    } finally {
        loader.style.display = 'none';
        generateBtn.disabled = false;
    }
});

// Control buttons
document.getElementById('reloadSceneBtn').addEventListener('click', () => {
    if (roomData.length > 0) {
        generateRoom(roomData);
    }
});

document.getElementById('resetViewBtn').addEventListener('click', () => {
    camera.position.set(8, 8, 8);
    camera.lookAt(0, 0, 0);
    controls.reset();
});

document.getElementById('toggleWireframeBtn').addEventListener('click', () => {
    wireframeMode = !wireframeMode;
    roomObjects.forEach(obj => {
        obj.traverse((child) => {
            if (child.isMesh && child.material) {
                child.material.wireframe = wireframeMode;
            }
        });
    });
});

document.getElementById('exportBtn').addEventListener('click', () => {
    const data = {
        roomData: roomData,
        timestamp: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'room-xyz-export.json';
    a.click();
    URL.revokeObjectURL(url);
});

// Initialize scene on load
initScene();
