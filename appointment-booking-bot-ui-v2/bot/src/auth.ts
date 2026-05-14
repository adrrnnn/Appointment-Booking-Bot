export const commonHeaders: Record<string, string> = {
  accept: "application/json",
  "accept-language": "en",
  "content-type": "application/json; charset=UTF-8",
  "sec-ch-ua":
    '"Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"macOS"',
  "sec-fetch-dest": "empty",
  "sec-fetch-mode": "cors",
  "sec-fetch-site": "same-origin",
};

let authTokenValue = "";

export function getAuthToken(): string {
  return authTokenValue;
}

export function setAuthToken(raw: string): void {
  const t = raw.trim();
  authTokenValue = /^bearer\s/i.test(t)
    ? t.replace(/^bearer\s+/i, "Bearer ")
    : `Bearer ${t}`;
}

export async function checkIsLoggedIn(port_code = "95"): Promise<boolean> {
  const testUrl =
    `https://fasah.zatca.gov.sa/api/zatca-tas/v2/zone/schedule/land?departure=AGF&arrival=${encodeURIComponent(port_code)}&type=TRANSIT&economicOperator=`;
  try {
    const response = await fetch(testUrl, {
      headers: {
        ...commonHeaders,
        token: getAuthToken(),
      },
      referrer: "https://fasah.zatca.gov.sa/en/broker/2.0/",
      body: null,
      method: "GET",
      mode: "cors",
      credentials: "include",
    });

    if (!response.ok) {
      return false;
    }

    const data = (await response.json()) as { success?: boolean };
    if (data.success === false) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}
