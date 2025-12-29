document.addEventListener('DOMContentLoaded', () => {
    console.log('Main JS loaded');

    // Navigation Smooth Scroll
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            document.querySelector(this.getAttribute('href')).scrollIntoView({
                behavior: 'smooth'
            });
            // Close mobile menu on click
            document.querySelector('.nav-links').classList.remove('active');
        });
    });

    // Mobile Menu
    const hamburger = document.querySelector('.hamburger');
    const navLinks = document.querySelector('.nav-links');

    if (hamburger) {
        hamburger.addEventListener('click', () => {
            navLinks.classList.toggle('active');
        });
    }

    // Game Modal Logic
    const gameModal = document.getElementById('game-modal');
    const startGameBtns = document.querySelectorAll('#start-game-btn, .btn-game');
    const closeModal = document.querySelector('.close-modal');

    // Make sure modal exists before adding listeners
    if (gameModal) {
        startGameBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                gameModal.classList.remove('hidden');

                // Trigger resize for 3D canvas
                setTimeout(() => {
                    window.dispatchEvent(new Event('resize'));
                    // Check if game instance needs resize call
                }, 100);
            });
        });

        if (closeModal) {
            closeModal.addEventListener('click', () => {
                gameModal.classList.add('hidden');
                // Could call game pause logic here
            });
        }

        window.addEventListener('click', (e) => {
            if (e.target === gameModal) {
                gameModal.classList.add('hidden');
            }
        });
    }

    // --------------------------------------------------------
    // SCROLL REVEAL ANIMATION (Fix for empty screen)
    // --------------------------------------------------------

    const observerOptions = {
        threshold: 0.1, // Trigger when 10% visible
        rootMargin: "0px 0px -50px 0px"
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
                observer.unobserve(entry.target); // Play animation once
            }
        });
    }, observerOptions);

    // Observe all elements with .reveal-up class
    const revealElements = document.querySelectorAll('.reveal-up');
    revealElements.forEach(el => {
        observer.observe(el);
    });

    // Fallback: If no intersection observer support or slow load, show everything
    if (!('IntersectionObserver' in window)) {
        revealElements.forEach(el => el.classList.add('active'));
    }
});
