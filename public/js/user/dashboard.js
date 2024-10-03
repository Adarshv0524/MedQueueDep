// dashboard.js

document.addEventListener("DOMContentLoaded", function() {
    const darkModeSwitch = document.getElementById("darkModeSwitch");
    const hamburger = document.getElementById("hamburger");
    const offCanvasNav = document.getElementById("offCanvasNav");

    // Check for saved user preference for dark mode
    const darkModePreference = localStorage.getItem("dark-mode");
    if (darkModePreference === "enabled") {
        document.body.classList.add("dark-mode");
    }

    // Toggle dark mode on button click
    darkModeSwitch.addEventListener("click", function() {
        document.body.classList.toggle("dark-mode");

        // Save preference in local storage
        if (document.body.classList.contains("dark-mode")) {
            localStorage.setItem("dark-mode", "enabled");
            darkModeSwitch.innerHTML = "☀️"; // Change icon to sun
        } else {
            localStorage.setItem("dark-mode", "disabled");
            darkModeSwitch.innerHTML = "🌙"; // Change icon to moon
        }
    });

    // Toggle Off-Canvas Navigation
    hamburger.addEventListener("click", () => {
        offCanvasNav.classList.toggle('active'); // Slide in/out the nav
        hamburger.classList.toggle('is-active'); // Optionally animate the hamburger icon
    });
    document.addEventListener("click", function(event) {
        // Check if the click was outside the off-canvas navigation and hamburger icon
        if (!offCanvasNav.contains(event.target) && !hamburger.contains(event.target)) {
            offCanvasNav.classList.remove('active'); // Hide the off-canvas nav
            hamburger.classList.remove('is-active'); // Reset the hamburger icon state
        }
    });
    


});
