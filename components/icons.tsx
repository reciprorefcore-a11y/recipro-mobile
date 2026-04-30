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
