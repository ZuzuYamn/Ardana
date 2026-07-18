import React from "react";
import { useLanguage } from "@/lib/contexts/LanguageContext";

interface AuthLayoutProps {
  children: React.ReactNode;
}

export function AuthLayout({ children }: AuthLayoutProps) {
  const { t } = useLanguage();
  return (
    <div className="relative min-h-[100dvh] overflow-hidden flex items-center justify-center p-4 sm:p-8">

      {/* ── Full-viewport illustrated background ──────────────────────── */}
      <svg
        aria-hidden="true"
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Sky gradient — warm dawn meets sage */}
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#e8f0d8" />
            <stop offset="45%"  stopColor="#c8ddb0" />
            <stop offset="100%" stopColor="#4a6e2a" />
          </linearGradient>

          {/* Sun glow */}
          <radialGradient id="sunGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="#f5d07a" stopOpacity="1"   />
            <stop offset="40%"  stopColor="#e8b84d" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#d4941e" stopOpacity="0"   />
          </radialGradient>

          {/* Far hill gradient */}
          <linearGradient id="hillFar" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#5a8035" />
            <stop offset="100%" stopColor="#3d5c22" />
          </linearGradient>

          {/* Mid hill gradient */}
          <linearGradient id="hillMid" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#3e5e1f" />
            <stop offset="100%" stopColor="#2a4415" />
          </linearGradient>

          {/* Near hill / field gradient */}
          <linearGradient id="hillNear" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#2e4c18" />
            <stop offset="100%" stopColor="#1a3010" />
          </linearGradient>

          {/* Center scrim — subtle vignette behind the form */}
          <radialGradient id="scrim" cx="50%" cy="50%" r="45%">
            <stop offset="0%"   stopColor="#0d1f0a" stopOpacity="0.38" />
            <stop offset="100%" stopColor="#0d1f0a" stopOpacity="0"    />
          </radialGradient>

          {/* AI node glow */}
          <radialGradient id="nodeGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="#b8e870" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#b8e870" stopOpacity="0"   />
          </radialGradient>

          {/* Leaf gradient */}
          <linearGradient id="leafGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%"   stopColor="#4a7a22" />
            <stop offset="100%" stopColor="#2d5012" />
          </linearGradient>

          {/* Leaf gradient 2 */}
          <linearGradient id="leafGrad2" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%"   stopColor="#3d6e1a" />
            <stop offset="100%" stopColor="#254510" />
          </linearGradient>

          {/* Wheat gradient */}
          <linearGradient id="wheatGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#c4a040" />
            <stop offset="60%"  stopColor="#7a9930" />
            <stop offset="100%" stopColor="#3a5c18" />
          </linearGradient>

          {/* Terracotta pot */}
          <linearGradient id="potGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#c4623a" />
            <stop offset="100%" stopColor="#8f3e20" />
          </linearGradient>
        </defs>

        {/* ── Sky ─────────────────────────────────────────────────────── */}
        <rect width="1440" height="900" fill="url(#sky)" />

        {/* ── Sun ─────────────────────────────────────────────────────── */}
        {/* Outer glow */}
        <circle cx="1090" cy="170" r="140" fill="url(#sunGlow)" />
        {/* Core disc */}
        <circle cx="1090" cy="170" r="62" fill="#f5d07a" fillOpacity="0.95" />
        <circle cx="1090" cy="170" r="52" fill="#fce89a" />
        {/* Sun rays */}
        {Array.from({ length: 12 }).map((_, i) => {
          const angle = (i * 30 * Math.PI) / 180;
          const r1 = 70, r2 = 105;
          return (
            <line key={i}
              x1={1090 + r1 * Math.cos(angle)} y1={170 + r1 * Math.sin(angle)}
              x2={1090 + r2 * Math.cos(angle)} y2={170 + r2 * Math.sin(angle)}
              stroke="#f0c84a" strokeWidth="3.5" strokeLinecap="round" strokeOpacity="0.7"
            />
          );
        })}

        {/* ── Clouds ──────────────────────────────────────────────────── */}
        {/* Cloud 1 — left */}
        <g opacity="0.82">
          <ellipse cx="240" cy="145" rx="90" ry="34" fill="white" />
          <ellipse cx="195" cy="155" rx="55" ry="28" fill="white" />
          <ellipse cx="290" cy="152" rx="60" ry="25" fill="white" />
          <ellipse cx="240" cy="162" rx="80" ry="20" fill="white" />
        </g>
        {/* Cloud 2 — center-left */}
        <g opacity="0.65">
          <ellipse cx="620" cy="100" rx="70" ry="26" fill="white" />
          <ellipse cx="580" cy="110" rx="42" ry="20" fill="white" />
          <ellipse cx="660" cy="108" rx="46" ry="20" fill="white" />
          <ellipse cx="620" cy="118" rx="60" ry="16" fill="white" />
        </g>
        {/* Cloud 3 — right (near sun, wispy) */}
        <g opacity="0.45">
          <ellipse cx="930" cy="95" rx="80" ry="22" fill="white" />
          <ellipse cx="895" cy="104" rx="48" ry="18" fill="white" />
          <ellipse cx="968" cy="104" rx="52" ry="17" fill="white" />
        </g>

        {/* ── Weather data badge (upper-left) ───────────────────────── */}
        <g transform="translate(72, 60)">
          <rect width="148" height="62" rx="14" fill="white" fillOpacity="0.18" stroke="white" strokeOpacity="0.3" strokeWidth="1" />
          {/* Thermometer */}
          <circle cx="26" cy="31" r="11" fill="#c4623a" fillOpacity="0.9" />
          <rect x="23" y="10" width="6" height="22" rx="3" fill="#c4623a" fillOpacity="0.9" />
          <text x="46" y="24" fontFamily="sans-serif" fontSize="10" fill="white" fillOpacity="0.85" fontWeight="600">{t('brand.auth_temp')}</text>
          <text x="46" y="38" fontFamily="sans-serif" fontSize="8.5" fill="white" fillOpacity="0.6">{t('brand.auth_watering')}</text>
          {/* Rain drops */}
          {[0,1,2].map(i => (
            <ellipse key={i} cx={46 + i * 12} cy={50} rx="3" ry="5" fill="#80b8e0" fillOpacity="0.7" />
          ))}
          <text x="86" y="54" fontFamily="sans-serif" fontSize="8" fill="white" fillOpacity="0.55">{t('brand.auth_humidity')}</text>
        </g>

        {/* ── Far hills ───────────────────────────────────────────────── */}
        <path
          d="M0 560 C120 490, 280 510, 420 480 C560 450, 680 490, 820 465
             C960 440, 1100 475, 1240 455 C1350 440, 1400 460, 1440 450 L1440 900 L0 900 Z"
          fill="url(#hillFar)"
        />

        {/* ── Mid hills ───────────────────────────────────────────────── */}
        <path
          d="M0 610 C80 575, 200 590, 340 565 C480 540, 580 575, 720 555
             C860 535, 980 568, 1100 550 C1220 532, 1360 560, 1440 545 L1440 900 L0 900 Z"
          fill="url(#hillMid)"
        />

        {/* ── Agricultural fields (near ground) ───────────────────────── */}
        {/* Field base */}
        <path
          d="M0 680 C160 658, 340 668, 520 650 C700 632, 880 658, 1060 642
             C1220 628, 1360 648, 1440 638 L1440 900 L0 900 Z"
          fill="url(#hillNear)"
        />

        {/* Field plot 1 — left section */}
        <rect x="0"   y="700" width="320" height="200" fill="#1e3e10" fillOpacity="0.9" />
        {Array.from({ length: 14 }).map((_, i) => (
          <line key={i} x1="8" y1={706 + i * 14} x2="312" y2={706 + i * 14}
            stroke="#2e5a18" strokeWidth="2" strokeOpacity="0.6" />
        ))}

        {/* Field plot 2 */}
        <rect x="328" y="712" width="250" height="188" fill="#243e12" fillOpacity="0.9" />
        {Array.from({ length: 13 }).map((_, i) => (
          <line key={i} x1="336" y1={718 + i * 14} x2="570" y2={718 + i * 14}
            stroke="#3a6020" strokeWidth="2" strokeOpacity="0.5" />
        ))}

        {/* Field plot 3 — center-right */}
        <rect x="860"  y="705" width="280" height="195" fill="#1e4010" fillOpacity="0.9" />
        {Array.from({ length: 13 }).map((_, i) => (
          <line key={i} x1="868" y1={711 + i * 14} x2="1132" y2={711 + i * 14}
            stroke="#2e5818" strokeWidth="2" strokeOpacity="0.55" />
        ))}

        {/* Field plot 4 — far right */}
        <rect x="1148" y="698" width="292" height="202" fill="#22420f" fillOpacity="0.9" />
        {Array.from({ length: 14 }).map((_, i) => (
          <line key={i} x1="1156" y1={704 + i * 14} x2="1432" y2={704 + i * 14}
            stroke="#365a18" strokeWidth="2" strokeOpacity="0.5" />
        ))}

        {/* ── Wheat stalks — left cluster ──────────────────────────────── */}
        {[30,55,80,105,125,148,168,188].map((x, i) => {
          const h = 130 + (i % 3) * 22;
          const sway = (i % 2 === 0 ? 1 : -1) * (8 + (i % 3) * 5);
          return (
            <g key={i}>
              {/* Stalk */}
              <path d={`M${x} 900 Q${x + sway * 0.3} ${900 - h * 0.5} ${x + sway} ${900 - h}`}
                stroke="url(#wheatGrad)" strokeWidth="2.2" fill="none" strokeLinecap="round" />
              {/* Head */}
              <ellipse cx={x + sway} cy={900 - h} rx="5" ry="14"
                fill="#c4a040" fillOpacity="0.85" />
              {/* Grain dots */}
              {[-1,0,1].map(j => (
                <circle key={j} cx={x + sway + j * 3} cy={900 - h + j * 5 - 4} r="2.2"
                  fill="#d4b050" fillOpacity="0.8" />
              ))}
            </g>
          );
        })}

        {/* ── Wheat stalks — right cluster ─────────────────────────────── */}
        {[1260,1285,1308,1330,1352,1372,1395,1418].map((x, i) => {
          const h = 120 + (i % 3) * 25;
          const sway = (i % 2 === 0 ? -1 : 1) * (6 + (i % 3) * 4);
          return (
            <g key={i}>
              <path d={`M${x} 900 Q${x + sway * 0.3} ${900 - h * 0.5} ${x + sway} ${900 - h}`}
                stroke="url(#wheatGrad)" strokeWidth="2.2" fill="none" strokeLinecap="round" />
              <ellipse cx={x + sway} cy={900 - h} rx="5" ry="13"
                fill="#c4a040" fillOpacity="0.85" />
              {[-1,0,1].map(j => (
                <circle key={j} cx={x + sway + j * 3} cy={900 - h + j * 5 - 4} r="2"
                  fill="#d4b050" fillOpacity="0.8" />
              ))}
            </g>
          );
        })}

        {/* ── Large botanical leaves — left ─────────────────────────────── */}
        {/* Leaf 1 */}
        <g transform="translate(-30, 480) rotate(-35, 140, 240)">
          <path d="M140 20 C200 80, 260 180, 240 320 C220 460, 150 490, 140 540
                   C130 490, 60 460, 40 320 C20 180, 80 80, 140 20 Z"
            fill="url(#leafGrad)" fillOpacity="0.88" />
          <path d="M140 20 L140 540" stroke="#2d5012" strokeWidth="2.5" strokeOpacity="0.5" />
          {[80,140,200,260,320,380,440].map((y, i) => {
            const w = 35 + Math.sin((y - 20) / 520 * Math.PI) * 80;
            return <line key={i} x1={140 - w} y1={y} x2={140 + w} y2={y}
              stroke="#3a6a1a" strokeWidth="1.2" strokeOpacity="0.3" />;
          })}
        </g>
        {/* Leaf 2 */}
        <g transform="translate(60, 540) rotate(-20, 100, 180)">
          <path d="M100 10 C150 55, 200 140, 185 250 C170 360, 110 385, 100 420
                   C90 385, 30 360, 15 250 C0 140, 50 55, 100 10 Z"
            fill="url(#leafGrad2)" fillOpacity="0.75" />
          <path d="M100 10 L100 420" stroke="#254510" strokeWidth="2" strokeOpacity="0.45" />
        </g>

        {/* ── Large botanical leaves — right ────────────────────────────── */}
        <g transform="translate(1220, 490) rotate(30, 140, 240)">
          <path d="M140 20 C200 80, 260 180, 240 320 C220 460, 150 490, 140 540
                   C130 490, 60 460, 40 320 C20 180, 80 80, 140 20 Z"
            fill="url(#leafGrad)" fillOpacity="0.85" />
          <path d="M140 20 L140 540" stroke="#2d5012" strokeWidth="2.5" strokeOpacity="0.45" />
          {[80,140,200,260,320,380,440].map((y, i) => {
            const w = 35 + Math.sin((y - 20) / 520 * Math.PI) * 80;
            return <line key={i} x1={140 - w} y1={y} x2={140 + w} y2={y}
              stroke="#3a6a1a" strokeWidth="1.2" strokeOpacity="0.3" />;
          })}
        </g>
        <g transform="translate(1320, 555) rotate(18, 100, 180)">
          <path d="M100 10 C150 55, 200 140, 185 250 C170 360, 110 385, 100 420
                   C90 385, 30 360, 15 250 C0 140, 50 55, 100 10 Z"
            fill="url(#leafGrad2)" fillOpacity="0.7" />
        </g>

        {/* ── Potted plant illustration — left foreground ───────────────── */}
        <g transform="translate(180, 748)">
          {/* Pot */}
          <path d="M-28 90 C-24 62, 24 62, 28 90 L22 120 L-22 120 Z" fill="url(#potGrad)" />
          <ellipse cx="0" cy="90" rx="28" ry="8" fill="#a84f30" />
          <ellipse cx="0" cy="120" rx="22" ry="6" fill="#7a3820" />
          {/* Soil */}
          <ellipse cx="0" cy="89" rx="24" ry="6" fill="#2a1a0a" fillOpacity="0.7" />
          {/* Plant stems */}
          <path d="M0 88 Q-18 58, -30 35" stroke="#3a6a1a" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M0 88 Q2 55, 8 30" stroke="#4a7a22" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M0 88 Q22 62, 32 38" stroke="#3a6a1a" strokeWidth="3" fill="none" strokeLinecap="round" />
          {/* Leaves */}
          <ellipse cx="-30" cy="32" rx="20" ry="10" fill="#4a7a22" transform="rotate(-30,-30,32)" />
          <ellipse cx="8"   cy="27" rx="18" ry="9"  fill="#5a8a2a" transform="rotate(10,8,27)" />
          <ellipse cx="32"  cy="35" rx="20" ry="10" fill="#4a7a22" transform="rotate(25,32,35)" />
        </g>

        {/* ── Potted plant — right foreground ──────────────────────────── */}
        <g transform="translate(1260, 740)">
          <path d="M-28 90 C-24 62, 24 62, 28 90 L22 120 L-22 120 Z" fill="url(#potGrad)" />
          <ellipse cx="0" cy="90" rx="28" ry="8" fill="#a84f30" />
          <ellipse cx="0" cy="120" rx="22" ry="6" fill="#7a3820" />
          <ellipse cx="0" cy="89" rx="24" ry="6" fill="#2a1a0a" fillOpacity="0.7" />
          <path d="M0 88 Q-15 55, -25 28" stroke="#4a7a22" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M0 88 Q5 52, 12 25" stroke="#3a6a1a" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M0 88 Q20 58, 30 34" stroke="#4a7a22" strokeWidth="3" fill="none" strokeLinecap="round" />
          <ellipse cx="-25" cy="25" rx="18" ry="9"  fill="#5a8a2a" transform="rotate(-25,-25,25)" />
          <ellipse cx="12"  cy="22" rx="17" ry="9"  fill="#4a7a22" transform="rotate(15,12,22)" />
          <ellipse cx="30"  cy="30" rx="18" ry="9"  fill="#3e7020" transform="rotate(20,30,30)" />
        </g>

        {/* ── AI sensor network overlay ─────────────────────────────────── */}
        {/* Field sensor nodes */}
        {[
          [160, 665], [400, 640], [720, 650], [1040, 638], [1310, 645],
          [280, 720], [580, 708], [860, 700], [1180, 695],
        ].map(([cx, cy], i) => (
          <g key={i}>
            <circle cx={cx} cy={cy} r="14" fill="#b8e870" fillOpacity="0.12" />
            <circle cx={cx} cy={cy} r="5.5" fill="#b8e870" fillOpacity="0.65" />
            <circle cx={cx} cy={cy} r="3"   fill="#d8f8a0" />
          </g>
        ))}

        {/* AI network connection lines */}
        {[
          [[160,665],[400,640]],
          [[400,640],[720,650]],
          [[720,650],[1040,638]],
          [[1040,638],[1310,645]],
          [[280,720],[580,708]],
          [[580,708],[860,700]],
          [[860,700],[1180,695]],
          [[160,665],[280,720]],
          [[400,640],[580,708]],
          [[720,650],[860,700]],
          [[1040,638],[1180,695]],
          [[1310,645],[1180,695]],
        ].map(([[x1,y1],[x2,y2]], i) => (
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
            stroke="#b8e870" strokeWidth="1" strokeOpacity="0.25" strokeDasharray="5 8" />
        ))}

        {/* AI data badge — right side */}
        <g transform="translate(1248, 56)">
          <rect width="158" height="68" rx="14" fill="white" fillOpacity="0.15" stroke="white" strokeOpacity="0.25" strokeWidth="1" />
          {/* Leaf icon */}
          <path d="M22 34 C22 20, 36 18, 40 28 C42 34, 36 42, 22 34 Z" fill="#7acc40" fillOpacity="0.9" />
          <path d="M22 34 C28 30, 36 26, 40 28" stroke="#5aaa28" strokeWidth="1.2" fill="none" />
          <text x="50" y="28" fontFamily="sans-serif" fontSize="10" fill="white" fillOpacity="0.88" fontWeight="600">{t('brand.ai_scan')}</text>
          <text x="50" y="42" fontFamily="sans-serif" fontSize="8.5" fill="white" fillOpacity="0.6">{t('brand.ai_scan_desc')}</text>
          {/* Health bar */}
          <rect x="50" y="50" width="90" height="7" rx="3.5" fill="white" fillOpacity="0.15" />
          <rect x="50" y="50" width="72" height="7" rx="3.5" fill="#7acc40" fillOpacity="0.7" />
          <text x="126" y="57" fontFamily="sans-serif" fontSize="7.5" fill="white" fillOpacity="0.55">80%</text>
        </g>

        {/* ── Subtle center scrim for form readability ─────────────────── */}
        <ellipse cx="720" cy="450" rx="520" ry="380" fill="url(#scrim)" />

        {/* ── Subtle global dark vignette at edges ─────────────────────── */}
        <rect width="1440" height="900"
          fill="none"
          style={{ filter: "url(#vignette)" }}
        />
        {/* Corners dark vignette via path */}
        <path d="M0 0 L360 0 C180 0, 0 180, 0 360 Z" fill="#0d1f0a" fillOpacity="0.18" />
        <path d="M1440 0 L1080 0 C1260 0, 1440 180, 1440 360 Z" fill="#0d1f0a" fillOpacity="0.18" />
        <path d="M0 900 L360 900 C180 900, 0 720, 0 540 Z" fill="#0d1f0a" fillOpacity="0.22" />
        <path d="M1440 900 L1080 900 C1260 900, 1440 720, 1440 540 Z" fill="#0d1f0a" fillOpacity="0.22" />
      </svg>

      {/* ── Form panel ─────────────────────────────────────────────────── */}
      <div className="relative z-10 w-full max-w-md">
        {children}
      </div>
    </div>
  );
}
