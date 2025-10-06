const container = document.getElementById('joystick-container');
const handle = document.getElementById('joystick-handle');
let containerRect,centerX,centerY,maxRadius;
containerRect = container.getBoundingClientRect();
centerX = containerRect.left + containerRect.width / 2;
centerY = containerRect.top + containerRect.height / 2;
maxRadius = (containerRect.width / 2) - (handle.clientWidth / 2);
let isDragging = false;

handle.addEventListener('mousedown', startDrag);
document.addEventListener('mousemove', drag);
document.addEventListener('mouseup', stopDrag);

handle.addEventListener('touchstart', (e) => startDrag(e.touches[0]));
document.addEventListener('touchmove', (e) => drag(e.touches[0]));
document.addEventListener('touchend', stopDrag);

function startDrag(event) {
    isDragging = true;
    handle.style.transition = 'none';
    if (event.preventDefault) {
        event.preventDefault();
    }
}

function drag(event) {
    if (!isDragging) return;
    const inputX = event.clientX;
    const inputY = event.clientY;
    
    containerRect = container.getBoundingClientRect();
    centerX = containerRect.left + containerRect.width / 2;
    centerY = containerRect.top + containerRect.height / 2;
    let deltaX = inputX - centerX;
    let deltaY = inputY - centerY;
    let distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    let newX, newY;

    if (distance > maxRadius) {
        let angle = Math.atan2(deltaY, deltaX);
        player.attackAngle = angle
        newX = Math.cos(angle) * maxRadius;
        newY = Math.sin(angle) * maxRadius;
        distance = maxRadius;
    } else {
        newX = deltaX;
        newY = deltaY;
    }

    handle.style.transform = `translate(${newX}px, ${newY}px)`;

    const normalizedX = (newX / maxRadius).toFixed(2);
    const normalizedY = (newY / maxRadius).toFixed(2);
    player.dx = Math.round(normalizedX * 100) / 100;
    player.dy = Math.round(normalizedY * 100) / 100;

}

function stopDrag() {
    isDragging = false;
    handle.style.transition = 'transform 0.1s ease-out';
    handle.style.transform = 'translate(0, 0)';
    player.dx=0
    player.dy=0
}