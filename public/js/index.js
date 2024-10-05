document.addEventListener("DOMContentLoaded", function () {
    const hamburgerToggle = document.getElementById("hamburgerToggle");
    const navLinks = document.getElementById("navLinks");
    const profileMenuToggle = document.getElementById("profileMenuToggle");
    const profileMenu = document.getElementById("profileMenu");

    // Toggle Hamburger Menu
    hamburgerToggle.addEventListener("click", function () {
        const expanded = hamburgerToggle.getAttribute("aria-expanded") === "true" || false;
        hamburgerToggle.setAttribute("aria-expanded", !expanded);
        navLinks.classList.toggle("active");
    });
    // document.addEventListener("click", function () {
    //     if 
    // });

    // Toggle Profile Menu
    profileMenuToggle.addEventListener("click", function (event) {
        event.preventDefault(); // Prevent default anchor behavior
        const expanded = profileMenuToggle.getAttribute("aria-expanded") === "true" || false;
        profileMenuToggle.setAttribute("aria-expanded", !expanded);
        profileMenu.classList.toggle("active");
    });

    // Close profile menu if clicked outside
    document.addEventListener("click", function (event) {
        if (!profileMenu.contains(event.target) && !profileMenuToggle.contains(event.target)) {
            profileMenu.classList.remove("active");
            profileMenuToggle.setAttribute("aria-expanded", false);
        }
    });
});
