// create a map instance and add it to the map div
let map = L.map('map', {center: [22.302711, 114.177216], zoom: 11});
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> | <a href="https://data.gov.hk/">DATA.GOV.HK</a>'
}).addTo(map);

// create markers group for real-time updating parking info
let markers = [];

// parking icon style
let parkingIcon = new L.Icon({
    iconUrl: './images/parking.png',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -15]
})

// pin icon style
let pinIcon = new L.Icon({
    iconUrl: './images/pin.png',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -15]
})

// mobile device detection
function isMobileDevice() {
    let hasTouchScreen = false;
    if ('maxTouchPoints' in navigator) {
        hasTouchScreen = navigator.maxTouchPoints > 0;
    } else if ('msMaxTouchPoints' in navigator) {
        hasTouchScreen = navigator.msMaxTouchPoints > 0;
    } else {
        const mQ = matchMedia?.('(pointer:coarse)');
        if (mQ?.media === '(pointer:coarse)') {
            hasTouchScreen = !!mQ.matches;
        } else if ('orientation' in window) {
            hasTouchScreen = true; // deprecated, but good fallback
        } else {
            // Only as a last resort, fall back to user agent sniffing
            const UA = navigator.userAgent;
            hasTouchScreen =
            /\b(BlackBerry|webOS|iPhone|IEMobile)\b/i.test(UA) ||
            /\b(Android|Windows Phone|iPad|iPod)\b/i.test(UA);
        }
    }
    return hasTouchScreen;
}

// get user's location
function getGeoLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(function(position) {
            let lat = position.coords.latitude;
            let lng = position.coords.longitude;
            map.setView([lat, lng], 15);
            L.marker([lat, lng], {icon: pinIcon}).addTo(map)
                .bindPopup('你的位置');
            L.circle([lat, lng], 200).addTo(map);

        });
    } else {
        alert('此瀏覽器不支援定位功能');
    }
}

// create url to redirect coordinates to client's map application
function genMapUrl(lat, lng) {
    let url = '';
    if (isMobileDevice()) {
        url = 'maps://maps.google.com/maps?q=' + lat + ',' + lng;
    } else {
        url = 'https://maps.google.com/maps?q=' + lat + ',' + lng;
    }
    return url;
}

// get parking information
function getParkingInfo() {
    const http_info = new XMLHttpRequest();
    const url_info = 'https://api.data.gov.hk/v1/carpark-info-vacancy?data=info&lang=zh_TW';
    let info;
    let vacancy;
    http_info.open('GET', url_info);
    http_info.send();
    http_info.onreadystatechange = function() {
        if (http_info.readyState == XMLHttpRequest.DONE && http_info.status == 200) {
            info = JSON.parse(http_info.responseText);
            const http_vacancy = new XMLHttpRequest();
            const url_vacancy = 'https://api.data.gov.hk/v1/carpark-info-vacancy?data=vacancy&lang=zh_TW';
            http_vacancy.open('GET', url_vacancy);
            http_vacancy.send();
            http_vacancy.onreadystatechange = function() {
                if (http_vacancy.readyState == XMLHttpRequest.DONE && http_vacancy.status == 200) {
                    vacancy = JSON.parse(http_vacancy.responseText);
                    // pass all data to privateCarHandler
                    privateCarHandler(info, vacancy);
                }
            }
        }
    }
}

function privateCarHandler(info, vacancy) {
    // remove all parking markers on map
    for (let i = 0; i < markers.length; i++) {
        map.removeLayer(markers[i]);
    }
    // empty markers group
    markers = [];
    // add markers
    for (let i = 0; i < info.results.length; i++) {
        for (let j = 0; j < vacancy.results.length; j++) {
            if (info.results[i].park_Id.localeCompare(vacancy.results[j].park_Id) == 0) {
                // skip if the carpark do not contain privateCar property
                if (!vacancy.results[j].hasOwnProperty('privateCar')) {
                    continue;
                }

                // TODO: It is known that only ONE item is in the privateCar array. If changed, possible errors may occur, please check in every release.
                let t = vacancy.results[j].privateCar[0].vacancy_type;
                let v = vacancy.results[j].privateCar[0].vacancy;
                let l = vacancy.results[j].privateCar[0].lastupdate;

                if (t === 'A') {
                    if (v === 0) {
                        v = '<span class="red">已滿</span>';
                    } else if (v === -1) {
                        v = '未能提供';
                    } else if (v <= 10) {
                        v = `<span class="orange">剩餘 ${v} 個</span>`;
                    } else {
                        v = `<span class="green">剩餘 ${v} 個</span>`;
                    }
                } else if (t === 'B') {
                    if (v === 0) {
                        v = '<span class="red">已滿</span>';
                    } else if (v === -1) {
                        v = '未能提供';
                    } else {
                        v = '<span class="green">有車位</span>';
                    }
                } else if (t === 'C') {
                    v = '<span class="red">私家車停車場已關閉</span>';
                }

                // add current opening status
                let o_html = '';
                if (info.results[i].hasOwnProperty('opening_status')) {
                    o_html = '開放狀態：';
                    if (info.results[i].opening_status.localeCompare('OPEN') == 0) {
                        o_html += '<span class="green">開放中</span>';
                    } else {
                        o_html += '<span class="red">已關閉</span>';
                    }
                }

                // add marker to map
                markers.push(L.marker([info.results[i].latitude, info.results[i].longitude], {icon: parkingIcon}).addTo(map)
                .bindPopup(info.results[i].name + '<br>' + 
                info.results[i].displayAddress + '<br>' + 
                o_html + '<br>' +
                '實時空位：' + v + '<br>' + 
                '最後更新：' + l + '<br>' + 
                '<a href="' + genMapUrl(info.results[i].latitude, info.results[i].longitude) + '" target="_blank">於地圖開啟</a>'));
            }
        }
    }
}

getGeoLocation();
getParkingInfo();
// update parking info every 1 minute
setInterval(getParkingInfo, 60000);
