/**
 * Official brand logo SVG components for each integration.
 * Each logo uses the official brand colors and simplified SVG paths.
 * All components accept className for sizing (default: w-6 h-6).
 */

interface LogoProps {
  className?: string;
}

export function SlackLogo({ className = 'w-6 h-6' }: LogoProps) {
  return (
    <svg className={className} viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
      <path d="M26.9 80.4a13.4 13.4 0 1 1-13.4-13.4h13.4v13.4z" fill="#E01E5A"/>
      <path d="M33.6 80.4a13.4 13.4 0 0 1 26.8 0v33.6a13.4 13.4 0 1 1-26.8 0V80.4z" fill="#E01E5A"/>
      <path d="M47 26.9a13.4 13.4 0 1 1 13.4-13.4V27H47z" fill="#36C5F0"/>
      <path d="M47 33.6a13.4 13.4 0 0 1 0 26.8H13.4a13.4 13.4 0 1 1 0-26.8H47z" fill="#36C5F0"/>
      <path d="M100.6 47a13.4 13.4 0 1 1 13.4 13.4h-13.4V47z" fill="#2EB67D"/>
      <path d="M93.9 47a13.4 13.4 0 0 1-26.8 0V13.4a13.4 13.4 0 1 1 26.8 0V47z" fill="#2EB67D"/>
      <path d="M80.5 100.6a13.4 13.4 0 1 1-13.4 13.4v-13.4h13.4z" fill="#ECB22E"/>
      <path d="M80.5 93.9a13.4 13.4 0 0 1 0-26.8h33.6a13.4 13.4 0 1 1 0 26.8H80.5z" fill="#ECB22E"/>
    </svg>
  );
}

export function HubSpotLogo({ className = 'w-6 h-6' }: LogoProps) {
  return (
    <svg className={className} viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
      <path d="M267.4 211.6c-25.1 23.7-40.8 57.3-40.8 94.6 0 37.3 15.7 70.9 40.8 94.6l-48.8 48.8c-7.7 7.7-20.2 7.7-27.9 0-7.7-7.7-7.7-20.2 0-27.9l.4-.4c-37-35.5-60-85.2-60-140.1s23-104.6 60-140.1l-.4-.4c-7.7-7.7-7.7-20.2 0-27.9s20.2-7.7 27.9 0l48.8 48.8z" fill="#FF7A59"/>
      <circle cx="350" cy="306" r="60" fill="#FF7A59"/>
      <path d="M350 186V136h-20v50c-36.4 8.5-63.7 40.5-63.7 79s27.3 70.5 63.7 79v50h20v-50c36.4-8.5 63.7-40.5 63.7-79s-27.3-70.5-63.7-79zm0 178c-27.6 0-50-22.4-50-50s22.4-50 50-50 50 22.4 50 50-22.4 50-50 50z" fill="#FF7A59"/>
    </svg>
  );
}

export function QuickBooksLogo({ className = 'w-6 h-6' }: LogoProps) {
  return (
    <svg className={className} viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
      <circle cx="128" cy="128" r="128" fill="#2CA01C"/>
      <path d="M83 88a24 24 0 0 0-24 24v32a24 24 0 0 0 48 0h16v-8a24 24 0 0 0-24-24h-16zm0 16h16v32a8 8 0 0 1-16 0v-32zm24 0a8 8 0 0 1 8 8v24h-8v-32z" fill="#fff"/>
      <path d="M173 88a24 24 0 0 1 24 24v32a24 24 0 0 1-48 0h-16v-8a24 24 0 0 1 24-24h16zm0 16h-16v32a8 8 0 0 0 16 0v-32zm-24 0a8 8 0 0 0-8 8v24h8v-32z" fill="#fff"/>
    </svg>
  );
}

export function GoogleCalendarLogo({ className = 'w-6 h-6' }: LogoProps) {
  return (
    <svg className={className} viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
      <path d="M152 0H48L0 48v104l48 48h104l48-48V48L200 0z" fill="#fff"/>
      <path d="M152 0l48 48h-48z" fill="#EA4335"/>
      <path d="M0 152l48 48V152z" fill="#34A853"/>
      <path d="M152 200l48-48H152z" fill="#4285F4"/>
      <path d="M0 48l48-48H0z" fill="#FBBC04"/>
      <rect x="48" y="48" width="104" height="104" fill="#fff"/>
      <path d="M48 0h104v48H48zm0 152h104v48H48zM0 48h48v104H0zm152 0h48v104h-48z" fill="#4285F4" opacity=".1"/>
      <rect x="48" y="48" width="104" height="104" rx="0" fill="#fff"/>
      <path d="M90 80h20v40H90z" fill="#4285F4"/>
      <path d="M80 110h40v10H80z" fill="#4285F4"/>
      <circle cx="100" cy="100" r="4" fill="#EA4335"/>
      <path d="M100 68v32" stroke="#EA4335" strokeWidth="3" fill="none"/>
      <path d="M100 100l20-12" stroke="#EA4335" strokeWidth="3" fill="none"/>
    </svg>
  );
}

export function GmailLogo({ className = 'w-6 h-6' }: LogoProps) {
  return (
    <svg className={className} viewBox="0 0 256 193" xmlns="http://www.w3.org/2000/svg">
      <path d="M58.2 192.1V93.7L0 50.6v125.5c0 8.8 7.2 16 16 16h42.2z" fill="#4285F4"/>
      <path d="M197.8 192.1h42.2c8.8 0 16-7.2 16-16V50.6l-58.2 43.1v98.4z" fill="#34A853"/>
      <path d="M197.8 16.9v76.8L256 50.6V24.9c0-19.7-22.5-31-38.2-19.1l-19.8 11.1z" fill="#FBBC04"/>
      <path d="M58.2 93.7V16.9l69.8 52.4 69.8-52.4v76.8L128 146.1 58.2 93.7z" fill="#EA4335"/>
      <path d="M0 24.9v25.7l58.2 43.1V16.9L38.4 5.8C22.5-6.1 0 5.2 0 24.9z" fill="#C5221F"/>
    </svg>
  );
}

export function JiraLogo({ className = 'w-6 h-6' }: LogoProps) {
  return (
    <svg className={className} viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="jira-a" x1="98.03%" x2="58.89%" y1="0.22%" y2="40.21%">
          <stop offset="18%" stopColor="#0052CC"/>
          <stop offset="100%" stopColor="#2684FF"/>
        </linearGradient>
        <linearGradient id="jira-b" x1="100.17%" x2="55.8%" y1="0.45%" y2="44.72%">
          <stop offset="18%" stopColor="#0052CC"/>
          <stop offset="100%" stopColor="#2684FF"/>
        </linearGradient>
      </defs>
      <path d="M244.7 121.8L138 15.2 128 5.3 41.1 92.2l-28.8 28.9c-4.3 4.3-4.3 11.3 0 15.6l79.5 79.5 36.2 36.2 86.9-86.9.8-.8 29-29c4.3-4.3 4.3-11.3 0-15.9zm-116.7 44L88.5 126.3 128 86.8l39.5 39.5-39.5 39.5z" fill="#2684FF"/>
      <path d="M128 86.8c-25.8-25.8-26-67.5-.5-93.5L41.1 79.7l47.4 47.4L128 86.8z" fill="url(#jira-a)"/>
      <path d="M167.7 126.1L128 165.8c25.9 25.9 26 67.8.2 93.8l86.5-86.5-46.9-47z" fill="url(#jira-b)"/>
    </svg>
  );
}

export function TrelloLogo({ className = 'w-6 h-6' }: LogoProps) {
  return (
    <svg className={className} viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
      <rect width="256" height="256" rx="25" fill="#0079BF"/>
      <rect x="36" y="36" width="80" height="168" rx="12" fill="#fff"/>
      <rect x="140" y="36" width="80" height="112" rx="12" fill="#fff"/>
    </svg>
  );
}

export function MicrosoftTeamsLogo({ className = 'w-6 h-6' }: LogoProps) {
  return (
    <svg className={className} viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
      <path d="M218 76a28 28 0 1 0 0-56 28 28 0 0 0 0 56z" fill="#5059C9"/>
      <path d="M256 120v60c0 11-9 20-20 20h-36c11 0 20-9 20-20v-76h16c11 0 20 9 20 16z" fill="#5059C9"/>
      <path d="M160 60a40 40 0 1 0 0-80 40 40 0 0 0 0 80z" fill="#7B83EB"/>
      <path d="M200 92H108c-6.6 0-12 5.4-12 12v80c0 33.1 26.9 60 60 60s60-26.9 60-60v-76c0-8.8-7.2-16-16-16z" fill="#7B83EB"/>
      <path d="M140 92v100c0 6.6-5.4 12-12 12H52c-6.6 0-12-5.4-12-12V92c0-6.6 5.4-12 12-12h76c6.6 0 12 5.4 12 12z" fill="#4B53BC"/>
      <path d="M108 120H72v-12h36v12zm0 20H72v-12h36v12zm-16 20H72v-12h20v12z" fill="#fff"/>
    </svg>
  );
}

export function GoogleSheetsLogo({ className = 'w-6 h-6' }: LogoProps) {
  return (
    <svg className={className} viewBox="0 0 256 351" xmlns="http://www.w3.org/2000/svg">
      <path d="M0 336V16C0 7 7 0 16 0h152l88 88v248c0 9-7 16-16 16H16c-9 0-16-7-16-16z" fill="#0F9D58"/>
      <path d="M168 0l88 88h-88z" fill="#87CEAC"/>
      <path d="M56 168h144v120H56z" fill="#F1F1F1"/>
      <path d="M56 168h144v24H56zm0 48h144v24H56zm0 48h144v24H56z" fill="#fff"/>
      <path d="M56 168h48v120H56z" fill="#fff" opacity=".2"/>
      <path d="M56 168h144v24H56z" fill="#0F9D58" opacity=".1"/>
      <path d="M56 168v120h144V168H56zm48 24v24H56v-24h48zm0 48v24H56v-24h48zm48-48v24h-40v-24h40zm0 48v24h-40v-24h40zm48-48v24h-40v-24h40zm0 48v24h-40v-24h40z" fill="#0F9D58" opacity=".2"/>
    </svg>
  );
}

export function AsanaLogo({ className = 'w-6 h-6' }: LogoProps) {
  return (
    <svg className={className} viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="asana-grad" x1="50%" x2="50%" y1="0%" y2="100%">
          <stop offset="0%" stopColor="#FFB900"/>
          <stop offset="60%" stopColor="#F95353"/>
          <stop offset="100%" stopColor="#F95353"/>
        </linearGradient>
      </defs>
      <circle cx="256" cy="126" r="110" fill="url(#asana-grad)"/>
      <circle cx="126" cy="386" r="110" fill="url(#asana-grad)"/>
      <circle cx="386" cy="386" r="110" fill="url(#asana-grad)"/>
    </svg>
  );
}

export function SalesforceLogo({ className = 'w-6 h-6' }: LogoProps) {
  return (
    <svg className={className} viewBox="0 0 256 180" xmlns="http://www.w3.org/2000/svg">
      <path d="M106.6 14.4c12.2-12.7 29.2-20.6 48-20.6 25.3 0 47.2 14.3 58.3 35.3 9.7-4.3 20.4-6.7 31.7-6.7 42.6 0 77.1 34.5 77.1 77.1s-34.5 77.1-77.1 77.1c-5.4 0-10.7-.6-15.8-1.6-9.8 15.8-27.1 26.3-46.9 26.3-10.4 0-20.1-2.9-28.4-7.9-10.4 20.2-31.5 34-56 34-25.3 0-47.2-15-57.3-36.6-4.2.8-8.6 1.3-13 1.3C12.6 192 .4 147.3 22 114c-7.9-12.7-12.5-27.6-12.5-43.6C9.5 31.5 42 0 80.9 0c10.6 0 20.6 2.3 29.6 6.5" fill="#00A1E0"/>
    </svg>
  );
}

export function ZoomLogo({ className = 'w-6 h-6' }: LogoProps) {
  return (
    <svg className={className} viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
      <rect width="256" height="256" rx="40" fill="#2D8CFF"/>
      <path d="M56 88h100c6.6 0 12 5.4 12 12v56c0 6.6-5.4 12-12 12H56c-6.6 0-12-5.4-12-12v-56c0-6.6 5.4-12 12-12z" fill="#fff"/>
      <path d="M180 108l36-24v88l-36-24v-40z" fill="#fff"/>
    </svg>
  );
}

export function GitHubLogo({ className = 'w-6 h-6' }: LogoProps) {
  return (
    <svg className={className} viewBox="0 0 256 250" xmlns="http://www.w3.org/2000/svg">
      <path d="M128 0C57.3 0 0 57.3 0 128c0 56.6 36.7 104.5 87.5 121.4 6.4 1.2 8.7-2.8 8.7-6.2 0-3-.1-11.1-.2-21.8-35.6 7.7-43.1-17.2-43.1-17.2-5.8-14.8-14.2-18.7-14.2-18.7-11.6-7.9.9-7.8.9-7.8 12.8.9 19.6 13.2 19.6 13.2 11.4 19.5 29.9 13.9 37.2 10.6 1.2-8.2 4.5-13.9 8.1-17.1-28.4-3.2-58.3-14.2-58.3-63.3 0-14 5-25.4 13.2-34.4-1.3-3.2-5.7-16.3 1.3-33.9 0 0 10.7-3.4 35.1 13.1 10.2-2.8 21.1-4.2 32-4.3 10.8.1 21.7 1.5 31.9 4.3 24.4-16.6 35.1-13.1 35.1-13.1 7 17.7 2.6 30.7 1.3 33.9 8.2 9 13.2 20.4 13.2 34.4 0 49.2-30 60-58.5 63.1 4.6 4 8.7 11.8 8.7 23.8 0 17.2-.2 31-.2 35.2 0 3.4 2.3 7.4 8.8 6.1C219.4 232.5 256 184.5 256 128 256 57.3 198.7 0 128 0z" fill="#181616"/>
    </svg>
  );
}

export function ZendeskLogo({ className = 'w-6 h-6' }: LogoProps) {
  return (
    <svg className={className} viewBox="0 0 256 198" xmlns="http://www.w3.org/2000/svg">
      <path d="M118 0v155L0 198V43c0-23.7 19.3-43 43-43h75z" fill="#03363D"/>
      <path d="M118 43L0 198h118V43z" fill="#03363D"/>
      <path d="M138 198V43l118 155V155c0-23.7-19.3-43-43-43h-75z" fill="#03363D"/>
      <path d="M138 155l118-155H138v155z" fill="#03363D"/>
    </svg>
  );
}

export function NotionLogo({ className = 'w-6 h-6' }: LogoProps) {
  return (
    <svg className={className} viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
      <path d="M36 4.7l140.6-3.4c17.3-1.4 21.7.9 32.5 8.7l44.8 31.5c7.4 5.4 9.8 6.8 9.8 12.7v166.4c0 10.3-3.8 16.3-17 17.2L82.7 248c-9.8.5-14.5-1-19.5-7.2L18.7 181c-6-8.2-8.5-14.3-8.5-21.7V20.8C10.2 12 14.5 5.6 36 4.7z" fill="#fff"/>
      <path d="M36 4.7l140.6-3.4c17.3-1.4 21.7.9 32.5 8.7l44.8 31.5c7.4 5.4 9.8 6.8 9.8 12.7v166.4c0 10.3-3.8 16.3-17 17.2L82.7 248c-9.8.5-14.5-1-19.5-7.2L18.7 181c-6-8.2-8.5-14.3-8.5-21.7V20.8C10.2 12 14.5 5.6 36 4.7z" fill="none" stroke="#000" strokeWidth="6"/>
      <path d="M84 46.7c-13.6 1-16.7 1.2-24.5-4.8L36.7 24.2c-2-1.6-0.9-3.5 3.5-3.8L176 17.7c14.5-1.2 21.7 3.9 27.4 8.3l27 19.6c1.2.9.3 3.5-3.5 3.8L86.9 53.7 84 46.7zm-28 178V76.5c0-6.2 1.9-9 7.5-9.5L222 59.8c5.4-.5 7.5 2.9 7.5 9v147c0 6.2-1 11.4-10 12L70 235c-9 .5-14-2.4-14-10.3zM207.7 84c.5 2.8 0 5.5-2.8 5.8l-6.5 1.3V203c-5.6 3-10.8 4.7-15.1 4.7-7 0-8.8-2.2-14-8.7l-42.8-67.3v65.1l13.3 3c0 0 0 5.5-7.7 5.5l-21.2 1.2c-.6-1.2 0-4.3 2.2-4.8l5.7-1.6v-86l-7.9-.6c-.5-2.8 1-6.8 5.6-7.1l22.8-1.5 44.5 68v-60.3l-11.2-1.3c-.5-3.3 1.8-5.7 4.8-6l22.3-1.5z" fill="#000"/>
    </svg>
  );
}

export function MondayLogo({ className = 'w-6 h-6' }: LogoProps) {
  return (
    <svg className={className} viewBox="0 0 256 128" xmlns="http://www.w3.org/2000/svg">
      <circle cx="224" cy="96" r="20" fill="#FDAB3D"/>
      <path d="M24 0c13.3 0 24 10.7 24 24v80c0 13.3-10.7 24-24 24S0 117.3 0 104V24C0 10.7 10.7 0 24 0z" fill="#F62B54"/>
      <path d="M92 24c13.3 0 24 10.7 24 24v56c0 13.3-10.7 24-24 24S68 117.3 68 104V48c0-13.3 10.7-24 24-24z" fill="#F62B54"/>
      <path d="M160 48c13.3 0 24 10.7 24 24v32c0 13.3-10.7 24-24 24s-24-10.7-24-24V72c0-13.3 10.7-24 24-24z" fill="#FDAB3D"/>
    </svg>
  );
}

/**
 * Map service_name → brand logo component.
 * Returns null if no brand logo is available (falls back to Lucide icon).
 */
export const SERVICE_BRAND_LOGOS: Record<string, (props: LogoProps) => JSX.Element> = {
  slack: SlackLogo,
  hubspot: HubSpotLogo,
  quickbooks: QuickBooksLogo,
  google_calendar: GoogleCalendarLogo,
  gmail: GmailLogo,
  jira: JiraLogo,
  trello: TrelloLogo,
  microsoft_teams: MicrosoftTeamsLogo,
  google_sheets: GoogleSheetsLogo,
  asana: AsanaLogo,
  salesforce: SalesforceLogo,
  zoom: ZoomLogo,
  github: GitHubLogo,
  zendesk: ZendeskLogo,
  notion: NotionLogo,
  monday: MondayLogo,
};
