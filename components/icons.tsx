type IconProps = {
  className?: string;
  size?: number;
};

export function IconAddPhoto({ className = "", size = 20 }: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" height={size} viewBox="0 0 24 24" width={size} fill="currentColor" className={className} aria-hidden="true">
      <rect fill="none" height="24" width="24" />
      <path d="M3,4V1h2v3h3v2H5v3H3V6H0V4H3z M6,10V7h3V4h7l1.83,2H21c1.1,0,2,0.9,2,2v12c0,1.1-0.9,2-2,2H5c-1.1,0-2-0.9-2-2V10H6z M13,19c2.76,0,5-2.24,5-5s-2.24-5-5-5s-5,2.24-5,5S10.24,19,13,19z M9.8,14c0,1.77,1.43,3.2,3.2,3.2s3.2-1.43,3.2-3.2s-1.43-3.2-3.2-3.2S9.8,12.23,9.8,14z" />
    </svg>
  );
}

export function IconPhotoLibrary({ className = "", size = 20 }: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" height={size} viewBox="0 0 24 24" width={size} fill="currentColor" className={className} aria-hidden="true">
      <path d="M0 0h24v24H0z" fill="none" />
      <path d="M22 16V4c0-1.1-.9-2-2-2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2zm-11-4l2.03 2.71L16 11l4 5H8l3-4zM2 6v14c0 1.1.9 2 2 2h14v-2H4V6H2z" />
    </svg>
  );
}

export function IconEdit({ className = "", size = 20 }: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width={size} height={size} fill="none" className={className} aria-hidden="true">
      <polyline
        points="6.63 33.39 34.25 5.76 42.74 14.25 15.11 41.87"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <polyline
        points="6.63 33.39 4.5 44 15.11 41.87"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <line
        x1="32.29" y1="15.72" x2="36.78" y2="20.21"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

export function IconSearch({ className = "", size = 20 }: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" height={size} viewBox="0 0 24 24" width={size} fill="currentColor" className={className} aria-hidden="true">
      <path d="M0,0h24v24H0V0z" fill="none" />
      <path d="M7,9H2V7h5V9z M7,12H2v2h5V12z M20.59,19l-3.83-3.83C15.96,15.69,15.02,16,14,16c-2.76,0-5-2.24-5-5s2.24-5,5-5s5,2.24,5,5c0,1.02-0.31,1.96-0.83,2.75L22,17.59L20.59,19z M17,11c0-1.65-1.35-3-3-3s-3,1.35-3,3s1.35,3,3,3S17,12.65,17,11z M2,19h10v-2H2V19z" />
    </svg>
  );
}

export function IconEditDocument({ className = "", size = 20 }: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" height={size} viewBox="0 0 20 20" width={size} fill="currentColor" className={className} aria-hidden="true">
      <rect fill="none" height="20" width="20" />
      <polygon points="11.5,16.23 11.5,18 13.27,18 17.44,13.83 15.67,12.06" />
      <path d="M16,6l-4-4H5.5C4.67,2,4,2.67,4,3.5v13C4,17.33,4.67,18,5.5,18H10v-2.39l6-6V6z M11,7V3l4,4H11z" />
      <path d="M18.85,11.71l-1.06-1.06c-0.2-0.2-0.51-0.2-0.71,0l-0.71,0.71l1.77,1.77l0.71-0.71C19.05,12.22,19.05,11.9,18.85,11.71z" />
    </svg>
  );
}

export function IconDoneAll({ className = "", size = 24 }: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" height={size} viewBox="0 0 24 24" width={size} fill="currentColor" className={className} aria-hidden="true">
      <path d="M0 0h24v24H0z" fill="none" />
      <path d="M18 7l-1.41-1.41-6.34 6.34 1.41 1.41L18 7zm4.24-1.41L11.66 16.17 7.48 12l-1.41 1.41L11.66 19l12-12-1.42-1.41zM.41 13.41L6 19l1.41-1.41L1.83 12 .41 13.41z" />
    </svg>
  );
}

export function IconDownload({ className = "", size = 20 }: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" height={size} viewBox="0 0 24 24" width={size} fill="currentColor" className={className} aria-hidden="true">
      <rect fill="none" height="24" width="24" />
      <path d="M5,20h14v-2H5V20z M19,9h-4V3H9v6H5l7,7L19,9z" />
    </svg>
  );
}

export function IconUpload({ className = "", size = 20 }: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" height={size} viewBox="0 0 24 24" width={size} fill="currentColor" className={className} aria-hidden="true">
      <rect fill="none" height="24" width="24" />
      <path d="M5,20h14v-2H5V20z M5,10h4v6h6v-6h4l-7-7L5,10z" />
    </svg>
  );
}

export function IconAuto({ className = "", size = 20 }: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" height={size} viewBox="0 0 20 20" width={size} fill="currentColor" className={className} aria-hidden="true">
      <rect fill="none" height="20" width="20" />
      <path d="M15.81,3.13c-1.39-1.18-3.14-1.93-5.06-2.09v1.5c1.51,0.15,2.88,0.75,3.99,1.66L15.81,3.13z" />
      <path d="M10,17.5c-2.66,0-4.98-1.41-6.31-3.5h2.06v-1.5H1v4.75h1.5v-2.29C4.11,17.39,6.86,19,10,19c4.01,0,7.41-2.63,8.57-6.25l-1.47-0.34C16.09,15.36,13.29,17.5,10,17.5z" />
      <path d="M9.25,2.54v-1.5C7.33,1.19,5.58,1.96,4.2,3.14L5.26,4.2C6.37,3.29,7.74,2.69,9.25,2.54z" />
      <path d="M4.2,5.26L3.14,4.2C1.96,5.59,1.2,7.33,1.04,9.25h1.5C2.69,7.74,3.29,6.37,4.2,5.26z" />
      <polygon points="6,10 8.75,11.25 10,14 11.25,11.25 14,10 11.25,8.75 10,6 8.75,8.75" />
      <path d="M17.46,9.25h1.51c-0.16-1.92-0.92-3.67-2.1-5.06L15.8,5.26C16.71,6.37,17.31,7.74,17.46,9.25z" />
    </svg>
  );
}

export function IconEditDocumentNew({ className = "", size = 20 }: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" height={size} viewBox="0 -960 960 960" width={size} fill="currentColor" className={className} aria-hidden="true">
      <path d="M560-80v-123l221-220q9-9 20-13t22-4q12 0 23 4.5t20 13.5l37 37q9 9 13 20t4 22q0 11-4.5 22.5T902.09-300L683-80H560Zm300-263-37-37 37 37ZM620-140h38l121-122-18-19-19-18-122 121v38ZM220-80q-24 0-42-18t-18-42v-680q0-24 18-42t42-18h340l240 240v116h-60v-76H520v-220H220v680h280v60H220Zm290-400Zm251 199-19-18 37 37-18-19Z" />
    </svg>
  );
}

export function IconLink({ className = "", size = 20 }: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" height={size} viewBox="0 -960 960 960" width={size} fill="currentColor" className={className} aria-hidden="true">
      <path d="M313-120q-81 0-137-56t-56-137q0-38 14.5-73.5T176-449l146-146 42 43-146 145q-19 19-29 43.5T179-313q0 56 39 94.5t95 38.5q26 0 50.5-10t43.5-29l146-145 42 42-146 146q-27 27-62.5 41.5T313-120Zm81-231-43-43 215-214 42 42-214 215Zm244-14-43-42 146-146q18-18 28-41.5t10-49.5q0-56-38.5-95.5T646-779q-26 0-50 9.5T553-741L407-595l-42-42 146-146q27-27 62.5-42t73.5-15q81 0 137 56.5T840-646q0 38-14.5 73.5T784-510L638-365Z" />
    </svg>
  );
}

export function IconLinkCamera({ className = "", size = 20 }: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" height={size} viewBox="0 -960 960 960" width={size} fill="currentColor" className={className} aria-hidden="true">
      <path d="M480-437Zm353-243q0-81-56.03-139T640-877v-43q100 0 170 70t70 170h-47Zm-87 0q0-45-30.5-76T640-787v-46q63.75 0 108.38 45Q793-743 789-680h-43ZM140-120q-24 0-42-18t-18-42v-513q0-23 18-41.5t42-18.5h147l73-87h240v60H388l-73 87H140v513h680v-460h60v460q0 24-18.5 42T820-120H140Zm339.5-147q72.5 0 121.5-49t49-121.5q0-72.5-49-121T479.5-607q-72.5 0-121 48.5t-48.5 121q0 72.5 48.5 121.5t121 49Zm0-60q-47.5 0-78.5-31.5t-31-79q0-47.5 31-78.5t78.5-31q47.5 0 79 31t31.5 78.5q0 47.5-31.5 79t-79 31.5Z" />
    </svg>
  );
}
