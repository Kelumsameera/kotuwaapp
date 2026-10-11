// Sri Lanka's 9 provinces and 25 districts, with main cities and postal codes.
// City names are English only for now; the app falls back to English for si/ta.
// More cities can be added here and re-seeded with `npm run seed:districts`.

const PROVINCES = {
  western: { en: 'Western', si: 'බස්නාහිර', ta: 'மேல்' },
  central: { en: 'Central', si: 'මධ්‍යම', ta: 'மத்திய' },
  southern: { en: 'Southern', si: 'දකුණු', ta: 'தென்' },
  northern: { en: 'Northern', si: 'උතුරු', ta: 'வட' },
  eastern: { en: 'Eastern', si: 'නැගෙනහිර', ta: 'கிழக்கு' },
  northWestern: { en: 'North Western', si: 'වයඹ', ta: 'வடமேல்' },
  northCentral: { en: 'North Central', si: 'උතුරු මැද', ta: 'வடமத்திய' },
  uva: { en: 'Uva', si: 'ඌව', ta: 'ஊவா' },
  sabaragamuwa: { en: 'Sabaragamuwa', si: 'සබරගමුව', ta: 'சப்ரகமுவ' },
};

// Small helper so each city line stays short.
function city(name, postalCode) {
  return { name: { en: name }, postalCode };
}

const DISTRICTS = [
  {
    key: 'colombo', province: 'western', name: { en: 'Colombo', si: 'කොළඹ', ta: 'கொழும்பு' },
    cities: [city('Colombo 01', '00100'), city('Colombo 03', '00300'), city('Colombo 05', '00500'), city('Colombo 07', '00700'), city('Dehiwala', '10350'), city('Mount Lavinia', '10370'), city('Moratuwa', '10400'), city('Nugegoda', '10250'), city('Maharagama', '10280'), city('Sri Jayawardenepura Kotte', '10100'), city('Homagama', '10200'), city('Kaduwela', '10640'), city('Avissawella', '10700')],
  },
  {
    key: 'gampaha', province: 'western', name: { en: 'Gampaha', si: 'ගම්පහ', ta: 'கம்பஹா' },
    cities: [city('Gampaha', '11000'), city('Negombo', '11500'), city('Ja-Ela', '11350'), city('Wattala', '11300'), city('Kadawatha', '11850'), city('Kiribathgoda', '11600'), city('Minuwangoda', '11550'), city('Veyangoda', '11100')],
  },
  {
    key: 'kalutara', province: 'western', name: { en: 'Kalutara', si: 'කළුතර', ta: 'களுத்துறை' },
    cities: [city('Kalutara', '12000'), city('Panadura', '12500'), city('Horana', '12400'), city('Beruwala', '12070'), city('Matugama', '12100')],
  },
  {
    key: 'kandy', province: 'central', name: { en: 'Kandy', si: 'මහනුවර', ta: 'கண்டி' },
    cities: [city('Kandy', '20000'), city('Peradeniya', '20400'), city('Katugastota', '20800'), city('Gampola', '20500'), city('Kundasale', '20168')],
  },
  {
    key: 'matale', province: 'central', name: { en: 'Matale', si: 'මාතලේ', ta: 'மாத்தளை' },
    cities: [city('Matale', '21000'), city('Dambulla', '21100'), city('Galewela', '21200')],
  },
  {
    key: 'nuwara_eliya', province: 'central', name: { en: 'Nuwara Eliya', si: 'නුවරඑළිය', ta: 'நுவரெலியா' },
    cities: [city('Nuwara Eliya', '22200'), city('Hatton', '22000'), city('Talawakele', '22100')],
  },
  {
    key: 'galle', province: 'southern', name: { en: 'Galle', si: 'ගාල්ල', ta: 'காலி' },
    cities: [city('Galle', '80000'), city('Hikkaduwa', '80240'), city('Ambalangoda', '80300'), city('Elpitiya', '80400')],
  },
  {
    key: 'matara', province: 'southern', name: { en: 'Matara', si: 'මාතර', ta: 'மாத்தறை' },
    cities: [city('Matara', '81000'), city('Weligama', '81700'), city('Akuressa', '81400')],
  },
  {
    key: 'hambantota', province: 'southern', name: { en: 'Hambantota', si: 'හම්බන්තොට', ta: 'அம்பாந்தோட்டை' },
    cities: [city('Hambantota', '82000'), city('Tangalle', '82200'), city('Tissamaharama', '82600'), city('Ambalantota', '82100')],
  },
  {
    key: 'jaffna', province: 'northern', name: { en: 'Jaffna', si: 'යාපනය', ta: 'யாழ்ப்பாணம்' },
    cities: [city('Jaffna', '40000'), city('Point Pedro', '40400'), city('Chavakachcheri', '40600'), city('Nallur', '40000')],
  },
  {
    key: 'kilinochchi', province: 'northern', name: { en: 'Kilinochchi', si: 'කිලිනොච්චිය', ta: 'கிளிநொச்சி' },
    cities: [city('Kilinochchi', '44000')],
  },
  {
    key: 'mannar', province: 'northern', name: { en: 'Mannar', si: 'මන්නාරම', ta: 'மன்னார்' },
    cities: [city('Mannar', '41000')],
  },
  {
    key: 'vavuniya', province: 'northern', name: { en: 'Vavuniya', si: 'වවුනියාව', ta: 'வவுனியா' },
    cities: [city('Vavuniya', '43000')],
  },
  {
    key: 'mullaitivu', province: 'northern', name: { en: 'Mullaitivu', si: 'මුලතිව්', ta: 'முல்லைத்தீவு' },
    cities: [city('Mullaitivu', '42000')],
  },
  {
    key: 'batticaloa', province: 'eastern', name: { en: 'Batticaloa', si: 'මඩකලපුව', ta: 'மட்டக்களப்பு' },
    cities: [city('Batticaloa', '30000'), city('Kattankudy', '30100'), city('Eravur', '30300')],
  },
  {
    key: 'ampara', province: 'eastern', name: { en: 'Ampara', si: 'අම්පාර', ta: 'அம்பாறை' },
    cities: [city('Ampara', '32000'), city('Kalmunai', '32300'), city('Akkaraipattu', '32400')],
  },
  {
    key: 'trincomalee', province: 'eastern', name: { en: 'Trincomalee', si: 'ත්‍රිකුණාමලය', ta: 'திருகோணமலை' },
    cities: [city('Trincomalee', '31000'), city('Kinniya', '31100')],
  },
  {
    key: 'kurunegala', province: 'northWestern', name: { en: 'Kurunegala', si: 'කුරුණෑගල', ta: 'குருநாகல்' },
    cities: [city('Kurunegala', '60000'), city('Kuliyapitiya', '60200'), city('Pannala', '60160'), city('Narammala', '60100')],
  },
  {
    key: 'puttalam', province: 'northWestern', name: { en: 'Puttalam', si: 'පුත්තලම', ta: 'புத்தளம்' },
    cities: [city('Puttalam', '61300'), city('Chilaw', '61000'), city('Wennappuwa', '61170')],
  },
  {
    key: 'anuradhapura', province: 'northCentral', name: { en: 'Anuradhapura', si: 'අනුරාධපුරය', ta: 'அனுராதபுரம்' },
    cities: [city('Anuradhapura', '50000'), city('Kekirawa', '50100'), city('Medawachchiya', '50500')],
  },
  {
    key: 'polonnaruwa', province: 'northCentral', name: { en: 'Polonnaruwa', si: 'පොළොන්නරුව', ta: 'பொலன்னறுவை' },
    cities: [city('Polonnaruwa', '51000'), city('Hingurakgoda', '51400')],
  },
  {
    key: 'badulla', province: 'uva', name: { en: 'Badulla', si: 'බදුල්ල', ta: 'பதுளை' },
    cities: [city('Badulla', '90000'), city('Bandarawela', '90100'), city('Ella', '90090'), city('Mahiyanganaya', '90700')],
  },
  {
    key: 'monaragala', province: 'uva', name: { en: 'Monaragala', si: 'මොණරාගල', ta: 'மொனராகலை' },
    cities: [city('Monaragala', '91000'), city('Wellawaya', '91200'), city('Bibile', '91500')],
  },
  {
    key: 'ratnapura', province: 'sabaragamuwa', name: { en: 'Ratnapura', si: 'රත්නපුර', ta: 'இரத்தினபுரி' },
    cities: [city('Ratnapura', '70000'), city('Balangoda', '70100'), city('Embilipitiya', '70200')],
  },
  {
    key: 'kegalle', province: 'sabaragamuwa', name: { en: 'Kegalle', si: 'කෑගල්ල', ta: 'கேகாலை' },
    cities: [city('Kegalle', '71000'), city('Mawanella', '71500'), city('Warakapola', '71600')],
  },
];

module.exports = { PROVINCES, DISTRICTS };
