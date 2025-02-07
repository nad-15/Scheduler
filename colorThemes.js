




const colorThemes = {
    // #1F456E // aegon
    default: { even: '#82c6a2', odd: '#53ab8b', sunday: '#3388cc' },   
    rustic: { even: '#c8b7a6', odd: '#5c4033', sunday: '#3e2723' },   
    almond: { even: '#dac0a3', odd: '#6f4e37', sunday: '#5d4037' },   
    mocha: { even: '#a1887f', odd: '#5d4037', sunday: '#3e2723' },   
    cocoa: { even: '#bcaaa4', odd: '#6d4c41', sunday: '#4e342e' },   
    tan: { even: '#ccb59d', odd: '#795548', sunday: '#6d4c41' },     
    latte: { even: '#e0c3a5', odd: '#8b5e3c', sunday: '#5d4037' },    
    earthy: { even: '#d7ccc8', odd: '#8d6e63', sunday: '#5c4033' },  
    espresso: { even: '#bfa58a', odd: '#704214', sunday: '#4e342e' }, 
    indigo: { even: '#7986cb', odd: '#3f51b5', sunday: '#1a237e' },   
    blue: { even: '#6a8caf', odd: '#4a6a8a', sunday: '#1a3d5f' },    
    slate: { even: '#90a4ae', odd: '#455a64', sunday: '#1F456E' },    
    gray: { even: '#bdbdbd', odd: '#9e9e9e', sunday: '#616161' },    
    purple: { even: '#b39ddb', odd: '#9575cd', sunday: '#673ab7' },  
    lavender: { even: '#e1bee7', odd: '#ab47bc', sunday: '#6a1b9a' }, 
    cyan: { even: '#4dd0e1', odd: '#0288d1', sunday: '#01579b' },     
    turquoise: { even: '#80deea', odd: '#00bcd4', sunday: '#00838f' }, 
    green: { even: '#82c6a2', odd: '#53ab8b', sunday: '#4a7c59' },   
    mint: { even: '#a5d6a7', odd: '#388e3c', sunday: '#1b5e20' },     
    lime: { even: '#dce775', odd: '#8bc34a', sunday: '#558b2f' },     
    teal: { even: '#4db6ac', odd: '#00897b', sunday: '#00695c' },    
    red: { even: '#ef9a9a', odd: '#e57373', sunday: '#d32f2f' },     
    coral: { even: '#ff8a65', odd: '#d32f2f', sunday: '#bf360c' },   
    pink: { even: '#f48fb1', odd: '#f06292', sunday: '#ad1457' },    
    orange: { even: '#f5a623', odd: '#d48806', sunday: '#bf360c' },  
    peach: { even: '#ffcc80', odd: '#f57c00', sunday: '#e65100' },    
    gold: { even: '#ffb74d', odd: '#f57c00', sunday: '#e65100' },     
    yellow: { even: '#fff176', odd: '#ffd54f', sunday: '#fbc02d' },  
    fatigue: { even: '#6c7c47', odd: '#3e4d34', sunday: '#2b3d28' },  
};

// Load the selected theme from localStorage or use 'default'
let selectedTheme = localStorage.getItem('theme') || 'default';


const menuButton = document.querySelector('.menu-button');
const menuSlider = document.querySelector('.menu-slider');
const overlayMenu = document.querySelector('.overlay-menu');
const closeButtonMenu = document.querySelector('.close-button-menu');

menuButton.addEventListener('click', () => {
    alert(`soooonnnnn...`);
    // menuSlider.classList.toggle('open');
    // overlay.classList.add('show');
});

closeButtonMenu.addEventListener('click', closeMenu);
overlay.addEventListener('click', closeMenu);

function closeMenu() {
    menuSlider.classList.remove('open');
    overlay.classList.remove('show');
}

