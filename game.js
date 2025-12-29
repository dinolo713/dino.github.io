class ShooterGame {
    constructor() {
        // UI Elements
        this.container = document.getElementById('game-stage-3d');
        this.scoreElement = document.getElementById('score');
        this.timerElement = document.getElementById('timer');
        this.hpBar = document.getElementById('hp-bar');
        this.levelElement = document.getElementById('level');
        this.damageOverlay = document.getElementById('damage-overlay');
        this.gameIntro = document.getElementById('game-intro');
        this.playBtn = document.getElementById('play-btn');
        this.playAgainBtn = document.getElementById('play-again-btn');

        // Skill UI
        this.skillQ = document.getElementById('skill-q');
        this.skillE = document.getElementById('skill-e');

        // Game State
        this.score = 0;
        this.combo = 0;
        this.lastKillTime = 0;
        this.timeLeft = 60;
        this.maxHp = 100;
        this.hp = 100;
        this.level = 1;
        this.isPlaying = false;

        // Combat State
        this.enemies = [];
        this.particles = [];
        this.enemySpawnRate = 60;
        this.globalSpeedMultiplier = 1.0;

        // Skills State
        this.skills = {
            emp: { ready: true, cooldown: 15, timer: 0, element: this.skillQ },
            overclock: { ready: true, active: false, cooldown: 20, duration: 5, timer: 0, element: this.skillE }
        };

        // Reuse Resources
        this.resources = {};

        // Three.js Core
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.raycaster = null;
        this.mouse = null;
        this.reticle = null;

        // Loop Vars
        this.animationId = null;
        this.spawnTimer = 0;
        this.gameInterval = null;
        this.clock = new THREE.Clock();

        if (typeof THREE === 'undefined') {
            console.error('Three.js not loaded!');
            return;
        }

        try {
            this.initThree();
            this.initResources();
            this.initEvents();
        } catch (e) {
            console.error('Init Error:', e);
        }
    }

    initThree() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0F172A);
        this.scene.fog = new THREE.FogExp2(0x0F172A, 0.02);

        const width = this.container.clientWidth || 800;
        const height = this.container.clientHeight || 600;
        this.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 100);
        this.camera.position.set(0, 2, 5);

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Limit pixel ratio for perf
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        this.container.appendChild(this.renderer.domElement);

        // Lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0x00E5FF, 0.8);
        dirLight.position.set(5, 10, 7);
        this.scene.add(dirLight);

        // Grid
        const grid = new THREE.GridHelper(100, 50, 0x00E5FF, 0x1E293B);
        this.scene.add(grid);

        // Stars
        this.createStars();

        // 3D Reticle
        const reticleGeo = new THREE.RingGeometry(0.3, 0.35, 32);
        const reticleMat = new THREE.MeshBasicMaterial({
            color: 0x00E5FF,
            transparent: true,
            opacity: 0.8,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending
        });
        this.reticle = new THREE.Mesh(reticleGeo, reticleMat);
        this.scene.add(this.reticle);
    }

    initResources() {
        // Geometry Pooling
        this.resources.virusRedGeo = new THREE.IcosahedronGeometry(1.5, 1);
        this.resources.virusGreenGeo = new THREE.IcosahedronGeometry(1.2, 0);
        this.resources.particleGeo = new THREE.IcosahedronGeometry(0.2, 0); // Reused for explosion

        // Material Pooling (Shared materials for better batching)
        this.resources.virusRedMat = new THREE.MeshPhongMaterial({
            color: 0xFF1744,
            emissive: 0xFF1744,
            emissiveIntensity: 0.5,
            flatShading: true
        });

        this.resources.virusGreenMat = new THREE.MeshPhongMaterial({
            color: 0x00E676,
            emissive: 0x00E676,
            emissiveIntensity: 0.4,
            flatShading: true
        });

        // Additive Blending for Particles (Glowing effect)
        this.resources.particleMatRed = new THREE.MeshBasicMaterial({
            color: 0xFF1744,
            transparent: true,
            blending: THREE.AdditiveBlending
        });
        this.resources.particleMatGreen = new THREE.MeshBasicMaterial({
            color: 0x00E676,
            transparent: true,
            blending: THREE.AdditiveBlending
        });
        this.resources.particleMatBlue = new THREE.MeshBasicMaterial({
            color: 0x00FFFF,
            transparent: true,
            blending: THREE.AdditiveBlending
        });

        // Laser Materials
        this.resources.laserMatNormal = new THREE.LineBasicMaterial({ color: 0x00E5FF, blending: THREE.AdditiveBlending });
        this.resources.laserMatOverclock = new THREE.LineBasicMaterial({ color: 0xFF00FF, blending: THREE.AdditiveBlending });
    }

    createStars() {
        const geo = new THREE.BufferGeometry();
        const pos = [];
        for (let i = 0; i < 1500; i++) {
            pos.push((Math.random() - 0.5) * 60, (Math.random() - 0.5) * 60, (Math.random() - 0.5) * 60);
        }
        geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        const mat = new THREE.PointsMaterial({
            size: 0.1,
            color: 0x00E5FF,
            transparent: true,
            opacity: 0.6,
            blending: THREE.AdditiveBlending
        });
        this.starMesh = new THREE.Points(geo, mat);
        this.scene.add(this.starMesh);
    }

    initEvents() {
        if (!this.playBtn) return;
        this.playBtn.addEventListener('click', () => this.start());
        this.playAgainBtn.addEventListener('click', () => this.start());

        this.container.addEventListener('mousemove', (e) => {
            if (!this.isPlaying) return;
            const rect = this.container.getBoundingClientRect();
            this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

            this.camera.position.x = this.mouse.x * 1.5;
            this.camera.position.y = 2 + (this.mouse.y * 0.8);
            this.camera.lookAt(0, 0, -10);
        });

        this.container.addEventListener('mousedown', () => {
            if (this.isPlaying) this.shoot();
        });

        window.addEventListener('keydown', (e) => {
            if (!this.isPlaying) return;
            if (e.key.toLowerCase() === 'q') this.useSkill('emp');
            if (e.key.toLowerCase() === 'e') this.useSkill('overclock');
        });

        window.addEventListener('resize', () => {
            if (!this.camera || !this.renderer) return;
            const w = this.container.clientWidth;
            const h = this.container.clientHeight;
            this.renderer.setSize(w, h);
            this.camera.aspect = w / h;
            this.camera.updateProjectionMatrix();
        });
    }

    start() {
        this.score = 0;
        this.combo = 0;
        this.timeLeft = 60;
        this.hp = this.maxHp;
        this.level = 1;
        this.enemySpawnRate = 60;
        this.globalSpeedMultiplier = 1.0;
        this.isPlaying = true;
        this.enemies = [];

        // Reset Skills
        this.skills.emp.ready = true;
        this.skills.emp.timer = 0;
        this.skills.overclock.ready = true;
        this.skills.overclock.active = false;
        this.skills.overclock.timer = 0;

        // Cleanup
        this.scene.traverse((obj) => {
            if (obj.userData && obj.userData.type) this.scene.remove(obj);
        });
        this.particles.forEach(p => this.scene.remove(p));
        this.particles = [];

        this.updateHUD();
        this.gameIntro.classList.add('hidden');
        this.playAgainBtn.classList.add('hidden');
        this.damageOverlay.classList.remove('active');

        if (this.gameInterval) clearInterval(this.gameInterval);
        this.gameInterval = setInterval(() => this.gameLogicStrick(), 1000);

        this.animate();
    }

    gameLogicStrick() {
        if (!this.isPlaying) return;

        this.timeLeft--;
        if (this.timeLeft <= 0) {
            this.gameOver('任務完成！時間到！');
            return;
        }

        this.updateSkillCooldown('emp');
        this.updateSkillCooldown('overclock');

        if (this.skills.overclock.active) {
            this.skills.overclock.durationTimer--;
            if (this.skills.overclock.durationTimer <= 0) this.skills.overclock.active = false;
        }

        this.checkLevelUp();
        this.updateHUD();
        this.updateReticle();
    }

    updateReticle() {
        if (!this.raycaster || !this.mouse || !this.reticle) return;

        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.enemies);

        let targetPos = new THREE.Vector3();

        if (intersects.length > 0) {
            targetPos.copy(intersects[0].point);
            this.reticle.material.color.setHex(0xFF0000);
            this.reticle.scale.setScalar(0.7);
        } else {
            this.raycaster.ray.at(25, targetPos);
            this.reticle.material.color.setHex(0x00E5FF);
            this.reticle.scale.setScalar(1.0 + Math.sin(this.clock.getElapsedTime() * 5) * 0.1); // Breathing effect
        }

        this.reticle.position.copy(targetPos);
        this.reticle.lookAt(this.camera.position);
    }

    updateSkillCooldown(name) {
        const skill = this.skills[name];
        if (!skill.ready) {
            skill.timer--;
            const percent = (skill.timer / skill.cooldown) * 100;
            const overlay = skill.element.querySelector('.skill-cooldown');
            if (overlay) overlay.style.height = `${percent}%`;

            if (skill.timer <= 0) {
                skill.ready = true;
                skill.element.classList.remove('cooldown');
                if (overlay) overlay.style.height = '0%';
            }
        }
    }

    checkLevelUp() {
        const newLevel = Math.floor((60 - this.timeLeft) / 15) + 1;
        if (newLevel > this.level) {
            this.level = newLevel;
            this.enemySpawnRate = Math.max(20, 60 - (this.level * 8));
            this.globalSpeedMultiplier = 1 + (this.level * 0.2);
            // maybe blink HUD
        }
    }

    useSkill(name) {
        const skill = this.skills[name];
        if (!skill.ready) return;

        if (name === 'emp') {
            this.enemies.forEach(e => {
                this.createExplosion(e, 0x00FFFF, 10);
                this.scene.remove(e);
            });
            this.enemies = [];

            this.damageOverlay.style.background = 'rgba(0, 229, 255, 0.5)';
            this.damageOverlay.classList.add('active');
            setTimeout(() => {
                this.damageOverlay.classList.remove('active');
                this.damageOverlay.style.background = '';
            }, 300);

        } else if (name === 'overclock') {
            skill.active = true;
            skill.durationTimer = skill.duration;
            const target = new THREE.Vector3(0, 0, -15).applyMatrix4(this.camera.matrixWorld);
            this.createLaserBeam(target, this.resources.laserMatOverclock);
        }

        skill.ready = false;
        skill.timer = skill.cooldown;
        skill.element.classList.add('cooldown');
    }

    spawnEnemy() {
        const type = Math.random() > 0.65 ? 'type1' : 'type2';
        let mesh;

        if (type === 'type1') {
            mesh = new THREE.Mesh(this.resources.virusRedGeo, this.resources.virusRedMat);
        } else {
            mesh = new THREE.Mesh(this.resources.virusGreenGeo, this.resources.virusGreenMat);
        }

        mesh.position.set(
            (Math.random() - 0.5) * 30,
            1 + Math.random() * 10,
            -45 - Math.random() * 20
        );

        mesh.userData = {
            type: type,
            speed: (type === 'type1' ? 0.35 : 0.25) * this.globalSpeedMultiplier,
            rotSpeed: new THREE.Vector3(Math.random() * 0.02, Math.random() * 0.02, Math.random() * 0.02),
            floatOffset: Math.random() * 10
        };

        this.scene.add(mesh);
        this.enemies.push(mesh);
    }

    shoot() {
        if (!this.raycaster || !this.mouse) return;

        this.raycaster.setFromCamera(this.mouse, this.camera);

        const threshold = this.skills.overclock.active ? 2.0 : 0.8;
        this.raycaster.params.Mesh.threshold = threshold;

        const intersects = this.raycaster.intersectObjects(this.enemies);

        const mat = this.skills.overclock.active ? this.resources.laserMatOverclock : this.resources.laserMatNormal;

        let targetPoint;

        if (intersects.length > 0) {
            targetPoint = intersects[0].point;
            this.destroyEnemy(intersects[0].object);
        } else {
            targetPoint = new THREE.Vector3();
            this.raycaster.ray.at(50, targetPoint);
        }

        this.createLaserBeam(targetPoint, mat);
    }

    destroyEnemy(enemy) {
        // Combo Logic
        const now = Date.now();
        if (now - this.lastKillTime < 1500) { // 1.5s window
            this.combo++;
        } else {
            this.combo = 1;
        }
        this.lastKillTime = now;

        const basePts = enemy.userData.type === 'type1' ? 100 : 50;
        const multiplier = Math.min(this.combo, 5); // Max 5x
        this.score += basePts * multiplier;

        // Determine color for explosion
        let colorHex = enemy.userData.type === 'type1' ? 0xFF1744 : 0x00E676;

        this.createExplosion(enemy, colorHex, 8);
        this.scene.remove(enemy);
        this.enemies = this.enemies.filter(e => e !== enemy);
        this.updateHUD();
    }

    createExplosion(enemyObj, colorHex, count) {
        const pos = enemyObj.position;
        // Choose material based on color
        let mat = this.resources.particleMatGreen;
        if (colorHex === 0xFF1744) mat = this.resources.particleMatRed;
        if (colorHex === 0x00FFFF) mat = this.resources.particleMatBlue; // EMP

        for (let i = 0; i < count; i++) {
            const mesh = new THREE.Mesh(this.resources.particleGeo, mat);
            mesh.position.copy(pos);
            mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);

            const speed = 0.3 + Math.random() * 0.3;
            const dir = new THREE.Vector3((Math.random() - 0.5), (Math.random() - 0.5), (Math.random() - 0.5)).normalize().multiplyScalar(speed);

            mesh.userData = {
                vel: dir,
                life: 1.0,
                rotVel: (Math.random() - 0.5) * 0.2
            };
            this.scene.add(mesh);
            this.particles.push(mesh);
        }
    }

    createLaserBeam(targetPoint, material) {
        const points = [];
        const startOffset = new THREE.Vector3(0.3, -0.6, -1).applyMatrix4(this.camera.matrixWorld);
        points.push(startOffset);

        if (targetPoint) {
            points.push(targetPoint);
        } else {
            const vec = new THREE.Vector3(this.mouse.x, this.mouse.y, 0.5).unproject(this.camera);
            vec.sub(this.camera.position).normalize().multiplyScalar(50).add(this.camera.position);
            points.push(vec);
        }

        const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), material);
        this.scene.add(line);
        setTimeout(() => this.scene.remove(line), 60); // Faster fade
    }

    takeDamage(amount) {
        this.hp -= amount;
        this.combo = 0; // Reset combo on damage
        if (this.hp < 0) this.hp = 0;

        this.damageOverlay.classList.add('active');
        setTimeout(() => this.damageOverlay.classList.remove('active'), 200);

        this.updateHUD();

        if (this.hp <= 0) {
            this.gameOver('警告！病毒感染！');
        }
    }

    updateHUD() {
        // Add Combo Text?
        let scoreText = `${this.score}`;
        if (this.combo > 1) scoreText += ` (x${this.combo})`;

        this.scoreElement.textContent = scoreText;
        this.timerElement.textContent = this.timeLeft;
        this.levelElement.textContent = this.level;
        this.hpBar.style.width = `${(this.hp / this.maxHp) * 100}%`;

        if (this.hp < 30) this.hpBar.style.background = '#FF1744';
        else this.hpBar.style.background = 'linear-gradient(90deg, #00E676, #00E5FF)';
    }

    animate() {
        if (!this.isPlaying) return;
        const time = this.clock.getElapsedTime();

        this.spawnTimer++;
        if (this.spawnTimer > this.enemySpawnRate) {
            this.spawnTimer = 0;
            if (this.enemies.length < 35) this.spawnEnemy();
        }

        this.enemies.forEach(e => {
            // Forward movement
            e.position.z += e.userData.speed;

            // Rotation
            e.rotation.x += e.userData.rotSpeed.x;
            e.rotation.y += e.userData.rotSpeed.y;
            e.rotation.z += e.userData.rotSpeed.z;

            // Floating (Sin wave on Y)
            e.position.y += Math.sin(time * 2 + e.userData.floatOffset) * 0.02;

            if (e.position.z > 5) {
                this.takeDamage(15);
                this.scene.remove(e);
                e.userData.dead = true;
            }
        });

        this.enemies = this.enemies.filter(e => !e.userData.dead);

        this.particles.forEach((p, i) => {
            p.position.add(p.userData.vel);
            p.rotation.x += p.userData.rotVel;
            p.userData.life -= 0.03;

            p.scale.setScalar(p.userData.life);

            if (p.userData.life <= 0) {
                this.scene.remove(p);
                this.particles[i] = null;
            }
        });
        this.particles = this.particles.filter(p => p !== null);

        if (this.starMesh) this.starMesh.rotation.z += 0.001;

        this.renderer.render(this.scene, this.camera);
        this.animationId = requestAnimationFrame(() => this.animate());
    }

    gameOver(reason) {
        this.isPlaying = false;
        clearInterval(this.gameInterval);
        cancelAnimationFrame(this.animationId);

        this.gameIntro.classList.remove('hidden');
        this.playBtn.classList.add('hidden');
        this.playAgainBtn.classList.remove('hidden');

        const h2 = this.gameIntro.querySelector('h2');
        const p = this.gameIntro.querySelector('p');
        h2.textContent = reason;
        p.innerHTML = `最終戰績：<span style="color:#00E5FF;font-size:1.5rem">${this.score}</span> 分<br>最大連擊：Max Combo`;
        // We didn't track max combo separately but score reflects it.
    }
}

window.onload = () => { new ShooterGame(); };
