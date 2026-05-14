/**
 * Compare our country data with the official Excel data
 */

// Official data from your Excel file
const officialData = `
160	جورجيا	GEORGIA	GE
270	جنوب السودان	South Sudan	SS
559	أيسل أوف مان	ISLE OF MAN	IM
571	كوراكاو	CURACAO	CW
570	غوريسني	GUERNSEY	GG
256	سانت هيلينا	SAINT HELENA	SH
460	سانت كيتس و نيفيس	SAINT KITTS AND NEVIS	KN
447	سانت لوسيا	SAINT LUCIA	LC
564	سانت بيري و ميقويلون	SAINT PIERRE AND 	PM
451	سانت فينسنت	SAINT VINCENT	VC
429	سلفادور	SALVADOR	SV
312	ساموا	SAMOA	WS
556	سان مارينو	SAN MARINO	SM
268	ساو تومي و برينسيبي	SAO TOME AND PRINCIPE	ST
100	السعودية	SAUDI ARABIA	SA
221	السنيغال	SENEGAL	SN
550	صربيا والجبل الاسود	SERBIA AND MONTENGRO	CS
261	سيشلس	SEYCHELLES	SC
224	سيراليون	SIERRA LEONE	SL
136	سنغافوره	SINGAPORE	SG
553	سلوفاكيا	SLOVAKIA	SK
547	سلوفانيا	SLOVENIA	SI
317	جزر سولومون	SOLOMON ISLANDS	SB
242	الصومال	SOMALIA	SO
254	جنوب افريقيا	SOUTH AFRICA	ZA
147	كوريا الجنوبية	SOUTH KOREA	KR
526	إسبانيا	SPAIN	ES
132	سريلانكا	SRI LANKA	LK
215	السودان	SUDAN	SD
423	سيرنام	SURINAME	SR
566	سفالبارد و جان ماين	SVALBARD AND JAN MAYEN	SJ
253	سوازي لاند	SWAZILAND	SZ
511	السويد	SWEDEN	SE
514	سويسرا	SWITZERLAND	CH
110	سوريا	SYRIA ARAB REPUBLIC	SY
143	تايوان	TAIWAN PROV.OF CHINA	TW
162	طاجكستان	TAJIKISTAN	TJ
245	تنزانيا	TANZANIA,UN REPUBLIC	TZ
134	تايلاند	THAILAND	TH
174	تيمور ليستي	TIMOR-LESTE	TL
229	توجو	TOGO	TG
329	توكيلاو	TOKELAU	TK
330	تونجا	TONGA	TO
419	ترينيداد و توباكو	TRINIDAD AND TOBACO	TT
525	تركيا	TURKEY	TR
159	تركمانستان	TURKMENISTAN	TM
567	جزر توركس _ كايكوس	TURKS_CAICOS ISLANDS	TC
331	توفاليو	TUVALU	TV
243	اوغندا	UGANDA	UG
544	اوكرانيا	UKRAINE	UA
120	الإمارات	UNITED ARAB EMIRATE	AE
521	المملكة المتحدة	UNITED KINGDOM	GB
410	أمريكا	UNITED STATES	US
441	أرجواي	URUGUAY	UY
461	جزر أمريكا الثانوية	U.S.MINOR OUTLYING	UM
158	أوزباكستان	UZBEKISTAN	UZ
450	فنواتو	VANUATU	VU
434	فنزويلا	VENEZUELA	VE
140	فيتنام	VIET NAM	VN
462	جزر فيرجين البريطاني	VIRGIN ISLANDS, U.K.	VG
332	واليس و فوتونا	WALLIS AND FUTUNA	WF
269	الصحراء الغربية	WESTERN SAHARA	EH
115	اليمن	YEMEN	YE
247	زامبيا	ZAMBIA	ZM
249	زيمبابوي	ZIMBABWE	ZW
128	أفغانستان	AFGHANISTAN	AF
950	الإتحاد الأوربي	EUROBIAN UNITED	EU
463	جزر فيرجيني الأمريكي	VIRGIN ISLANDS, U.S.	VI
299	دولة تجريب		TS
970	تجربة دولة		rt
538	ألبانيا	ALBANIA	AL
558	أندورا	ANDORRA	AD
246	أنجولا	ANGOLA	AO
464	أنجويلا	ANGUILLA	AI
175	انتاركتيكا	ANTARCTICA	AQ
416	أنتيقوا و باربودا	ANTIGUA AND BARBUDA	AG
442	الأرجنتين	ARGENTINA	AR
157	أرمينيا	ARMENIA	AM
453	أروبا	ARUBA	AW
310	أستراليا	AUSTRALIA	AU
516	النمسا	AUSTRIA	AT
156	أذربيجان	AZERBAIJAN	AZ
414	بهاما	BAHAMAS	BS
116	البحرين	BAHRAIN	BH
130	بنغلادش	BANGLADESH	BD
418	بربدوس	BARBADOES	BB
166	بيلاروس	BELARUS	BY
519	بلجيكا	BELGIUM	BE
448	بيليز	BELIZE	BZ
230	بنين	BENIN	BJ
413	برمودا	BERMUDA	BM
167	بهوتان	BHUTAN	BT
438	بوليفيا	BOLIVIA	BO
549	البوسنة والهرسك	BOSNIA_HERZEGOVINA	BA
251	بوتسوانا	BOTSWANA	BW
168	جزيرة بوفيت	BOUVET ISLAND	BV
439	البرازيل	BRAZIL	BR
169	بريتش انديان اوشن	BRITISH INDIAN OCEAN	IO
151	بروناي دار السلام	BRUNEI DARUSSALAM	BN
539	بلغاريا	BULGARIA	BG
264	بوركينا فاسو	BURKINA FASO	BF
239	بوروندي	BURUNDI	BI
138	كامبوديا	CAMBODIA	KH
232	الكاميرون	CAMEROON	CM
411	كندا	CANADA	CA
262	جزر كيب فردي	CAPE VERDE ISLANDS	CV
449	جزر الكيمان	CAYMAN ISLANDS	KY
233	جمهورية افريقيا وسطى	CENTRAL AFRICA REPUB	CF
220	تشاد	CHAD	TD
437	تشيلي	CHILE	CL
142	الصين الشعبية	CHINA	CN
170	جزيرة كريسماس	CHRISTMAS ISLAND	CX
171	جزر كوكوس (كيلينج)	COCOS ISLANDS	CC
433	كولومبيا	COLOMBIA	CO
257	جزر القمر	COMOROS ISLANDS	KM
235	كونغو	CONGO	CG
265	كونجو	CONGO	CD
333	جزر كوك	COOK ISLANDS	CK
431	كوستاريكا	COSTA RICA	CR
548	كرواتيا	CROATIA	HR
425	كوبا	CUBA	CU
531	قبرص	CYPRUS	CY
537	التشيك	CZECH REPUBLIC	CZ
513	الدنمارك	DENMARK	DK
241	جيبوتي	DJIBOUTI	DJ
417	دومينكا	DOMINICA	DM
427	جمهورية الدومينيكان	DOMINICAN REPUBLIC	DO
435	أكوادور	ECUADOR	EC
214	مصر	EGYPT	EG
237	غينيا الاستوائية	EQUATORIAL GUINEA	GQ
263	أريتريا	ERETRIA	ER
541	استونيا	ESTONIA	EE
240	اثيوبيا	ETHIOPIA	ET
560	جزر فولكلاند	FALKLAND ISLANDS	FK
561	جزر فاروي	FAROE ISLANDS	FO
311	فيجي	FIJI	FJ
510	فنلندا	FINLAND	FI
522	فرنسا	FRANCE	FR
424	غينيا الفرنسية	FRENCH GUIANA	GF
321	بولينسيا الفرنسية	FRENCH POLYNESIA	PF
322	مناطق فرنسا الشمالية	FRENCH SOUTHERN	TF
234	جابون	GABON	GA
222	جامبيا	GAMBIA	GM
565	جزر جورجيا و ساندويش	GEORGIA AND ISL	GS
517	المانيا	GERMANY	DE
226	غانا	GHANA	GH
529	جبل طارق	GIBRALTAR	GI
524	اليونان	GREECE	GR
562	جرينلاند	GREENLAND	GL
454	جرينادا	GRENADA	GD
455	جواديلوبي	GUADELOUPE	GP
316	جوام	GUAM	GU
428	جواتيمالا	GUATEMALA	GT
223	غينيا	GUINEA	GN
266	غينيا بيساو	GUINEA-BISSAU	GW
422	غوانا	GUYANA	GY
426	هاييتي	HAITI	HT
323	جزر هيرد و ماكدونالد	HEARD AND ISLAND	HM
563	هولي سي	HOLY SEE	VA
421	هوندوراس	HONDURAS	HN
145	هونج كونج	HONG KONG	HK
535	هنجاريا	HUNGARY	HU
528	أيسلندا	ICELAND	IS
131	الهند	INDIA	IN
152	أندونيسيا	INDONESIA	ID
127	إيران	IRAN	IR
114	العراق	IRAQ	IQ
500	إيرلندا	IRELAND	IE
523	إيطاليا	ITALY	IT
227	ساحل العاج(كوت ديفوا	DIVORY COAST	CI
415	جامايكا	JAMAICA	JM
148	اليابان	JAPAN	JP
112	الأردن	JORDAN	JO
164	كازاخستان	KAZAKHSTAN	KZ
244	كينيا	KENYA	KE
324	كيريباتي	KIRIBATI	KI
113	الكويت	KUWAIT	KW
163	قيرقيزيستان	KYRGYZSTAN	KG
137	لاو	LAO	LA
542	لاتفيا	LATVIA	LV
111	لبنان	LEBANON	LB
252	ليسوتو	LESOTHO	LS
225	ليبريا	LIBERIA	LR
557	ليختنشتاين	LIECHTENSTEIN	LI
543	لتوانيا	LITHWANIA	LT
520	لوكسمبورج	LUXEMBOURG	LU
144	ماكاو	MACAO	MO
554	مقدونيا	MACEDONIA	MK
258	مدغشقر	MADAGASCAR	MG
248	ملاوي	MALAWI	MW
135	ماليزيا	MALAYSIA	MY
155	مالديف	MALDIVES	MV
218	مالي	MALI	ML
530	مالطة	MALTA	MT
452	جزر مارشال	MARSHALL ISLAND	MH
456	مارتينيقوي	MARTINIQUE	MQ
217	موريتانيا	MAURITANIA	MR
259	موريشيوس	MAURITIUS	MU
267	مايوتي	MAYOTTE	YT
443	مكسيك	MEXICO	MX
172	ميكرونيسيا	MICRONESIA	FM
546	مولدافيا	MOLDOVA, REPUBLIC OF	MD
555	موناكو	MONACO	MC
141	منغوليا	MONGOLIA	MN
457	مونتسيرات	MONTSERRAT	MS
250	موزمبيق	MOZAMBIQUE	MZ
133	ماينامار	MYANMAR	MM
255	ناميبيا	NAMEBIA	NA
325	ناورو	NAURU	NR
154	نيبال	NEPAL	NP
518	هولندا	NETHERLAND	NL
458	نيثرلاندز انتيليز	NETHERLANDS ANTILLES	AN
318	كاليدونيا الجديدة	NEW CALEDONIA	NC
313	نيوزيلاندا	NEW ZEALAND	NZ
430	نيكاراجوا	NICARAGUA	NI
219	النيجر	NIGER	NE
231	نيجيريا	NIGERIA	NG
326	نايوي	NIUE	NU
459	جزيرة نورفولك	NORFOLK ISLAND	NF
146	كوريا الشمالية	NORTH KOREA	KP
173	جزر ماريانا الشمالية	NORTH MARIANA ISLAND	MP
512	النرويج	NORWAY	NO
119	عمان	OMAN	OM
129	باكستان	PAKISTAN	PK
327	بالاو	PALAU	PW
165	فلسطين	PALESTINE	PS
432	بنما	PANAMA	PA
320	بابوا(غينيا الجديدة)	PAPUA NEW GUINEA	PG
440	براجواي	PARAGUAY	PY
436	بيرو	PERU	PE
150	الفلبين	PHILIPPINES	PH
328	بيتكايرن	PITCAIRN	PN
533	بولندا (بولونيا)	POLAND	PL
515	البرتغال	PORTUGAL	PT
412	بورتوريكو	PUERTO RICO	PR
117	قطر	QATAR	QA
260	ريونيون	REUNION	RE
540	رومانيا	ROMANIA	RO
551	روسيا	RUSSIAN	RU
238	رواندا	RWANDA	RW
999	غير معروف	UNKNOWN	UN
568	صربيا	SERBIA	RS
569	ساموا الأمريكيه	AMERICAN SAMOA	AS
573	الجبل الأسود	MONTENEQRO	ME
572	جيرسي	JERSEY	JE
998	جزر اليورادور	LWARD ISLANDS	LI
605	جمهورية كوسوفو	Kosovo	KS
611	سينت مارتن	Sint Maarten	SX
606	جزر آلاند	Aland Islands	AX
608	كوسوفا	Kosovo	XK
607	بونير وسانت يوستاتيو	Bonaire, Sint Eustat	BQ
610	سانت مارتن	Saint Martin	MF
609	سانت بارتيليمي	Saint Barthelemy	BL
`.trim();

// Parse official data
const officialCountries = {};
officialData.split('\n').forEach(line => {
  const parts = line.split('\t');
  if (parts.length >= 4) {
    const apiValue = parts[0].trim();
    const name = parts[2].trim();
    const code = parts[3].trim();
    if (code && apiValue && name) {
      officialCountries[code] = { apiValue, name, code };
    }
  }
});

// Import our current data
const { MOST_USED_COUNTRIES, ALL_COUNTRIES } = require('../src/data/countries.ts');

console.log('=== OFFICIAL DATA COMPARISON ===\n');

// Key countries to check
const keyCountries = ['SA', 'EG', 'JO', 'AE', 'OM', 'TR', 'SY', 'BH', 'KW', 'QA'];

console.log('1. Key Gulf/Regional Countries:');
keyCountries.forEach(code => {
  const official = officialCountries[code];
  const ourMost = MOST_USED_COUNTRIES.find(c => c.code === code);
  const ourAll = ALL_COUNTRIES.find(c => c.code === code);
  
  if (official) {
    console.log(`\n${code} (${official.name}):`);
    console.log(`  Official API value: ${official.apiValue}`);
    if (ourMost) console.log(`  Our MOST_USED value: ${ourMost.apiValue} ✅`);
    if (ourAll) console.log(`  Our ALL_COUNTRIES value: ${ourAll.apiValue} ✅`);
    if (ourMost && ourAll && ourMost.apiValue !== ourAll.apiValue) {
      console.log(`  ❌ CONFLICT: Different values in MOST_USED vs ALL_COUNTRIES!`);
    } else if (ourMost && ourMost.apiValue !== official.apiValue) {
      console.log(`  ❌ WRONG: Should be ${official.apiValue}, we have ${ourMost.apiValue}`);
    } else if (ourAll && ourAll.apiValue !== official.apiValue) {
      console.log(`  ❌ WRONG: Should be ${official.apiValue}, we have ${ourAll.apiValue}`);
    } else if (!ourMost && !ourAll) {
      console.log(`  ❌ MISSING: Not found in our data!`);
    }
  } else {
    console.log(`\n${code}: ❌ NOT FOUND in official data`);
  }
});

console.log('\n\n2. Issues Found:');

// Check for wrong values
let wrongValues = 0;
let duplicates = 0;

MOST_USED_COUNTRIES.forEach(our => {
  const official = officialCountries[our.code];
  if (official && official.apiValue !== our.apiValue) {
    console.log(`❌ ${our.code}: Official=${official.apiValue}, Our=${our.apiValue} (${our.name})`);
    wrongValues++;
  }
});

ALL_COUNTRIES.forEach(our => {
  const official = officialCountries[our.code];
  const inMostUsed = MOST_USED_COUNTRIES.find(m => m.code === our.code);
  
  if (inMostUsed) {
    console.log(`🔄 DUPLICATE: ${our.code} appears in both MOST_USED and ALL_COUNTRIES`);
    duplicates++;
  } else if (official && official.apiValue !== our.apiValue) {
    console.log(`❌ ${our.code}: Official=${official.apiValue}, Our=${our.apiValue} (${our.name})`);
    wrongValues++;
  }
});

console.log(`\n3. Summary:`);
console.log(`   Wrong values: ${wrongValues}`);
console.log(`   Duplicates: ${duplicates/2} countries`);
console.log(`   Official countries: ${Object.keys(officialCountries).length}`);
console.log(`   Our total: ${MOST_USED_COUNTRIES.length + ALL_COUNTRIES.length}`);