import { type Writable, writable } from "svelte/store";
import {
  Dmart,
  ResourceType,
  type ActionRequestRecord,
  type SendOTPRequest,
} from "@edraj/tsdmart";
import { authToken } from "@/stores/auth";
import { getLocaleFromNavigator } from "svelte-i18n";
import { Toast } from "flowbite-svelte";
import { FireOutline } from "flowbite-svelte-icons";

enum Locale {
  ar = "ar",
  en = "en",
}

export interface User {
  signedin: boolean;
  locale: Locale;
  shortname?: string;
  localized_displayname?: string;
  account?: Object;
}

const KEY = "user";

const fallback_locale = Locale.ar;
function guess_locale(): Locale {
  const _locale = getLocaleFromNavigator();

  if (_locale && _locale in Locale) {
    return Locale[_locale];
  }

  return fallback_locale;
}

let signedout: User = { signedin: false, locale: guess_locale() };
export let user: Writable<User>;

// Load the user information from store, if it exists
const data =
  typeof localStorage !== "undefined"
    ? localStorage.getItem(KEY) || JSON.stringify(signedout)
    : JSON.stringify(signedout);
user = writable<User>(JSON.parse(data) || signedout);

export async function signin(username: string, password: string) {
  const response = await Dmart.login(username, password);
  if (response.status == "success" && response.records.length > 0) {
    const account = response.records[0];
    const auth = account.attributes.access_token;
    authToken.set(auth);

    if (typeof localStorage !== "undefined")
      localStorage.setItem("authToken", auth);

    const _user: User = {
      signedin: true,
      locale: Locale.ar,
      shortname: account.shortname,
      localized_displayname: account.attributes?.displayname?.en,
      account: account,
    };
    user.set(_user);
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(KEY, JSON.stringify(_user));
      localStorage.setItem("rowPerPage", "15");
    }
  } else {
    user.set(signedout);
    if (typeof localStorage !== "undefined")
      localStorage.setItem(KEY, JSON.stringify(signedout));
  }
}

export async function loginBy(email: string, password: string) {
  const response = await Dmart.loginBy({ email: email }, password);
  if (response.status == "success" && response.records.length > 0) {
    const account = response.records[0];
    const auth = account.attributes.access_token;
    authToken.set(auth);

    if (typeof localStorage !== "undefined")
      localStorage.setItem("authToken", auth);

    const _user: User = {
      signedin: true,
      locale: Locale.ar,
      shortname: account.shortname,
      localized_displayname: account.attributes?.displayname?.en,
      account: account,
    };
    user.set(_user);
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(KEY, JSON.stringify(_user));
      localStorage.setItem("rowPerPage", "15");
    }
  } else {
    user.set(signedout);
    if (typeof localStorage !== "undefined")
      localStorage.setItem(KEY, JSON.stringify(signedout));
  }
}

export async function requestOtp(email: string): Promise<string> {
  const request: SendOTPRequest = { email: email };
  try {
    const response = await Dmart.otp_request(request);
    if (response.status === "success") {
      return response.records[0].attributes.request_id;
    } else {
      throw new Error(response.error?.message || "OTP request failed");
    }
  } catch (error: any) {
    if (error.response?.data?.error?.message) {
      throw new Error(error.response.data.error.message);
    } else if (error.message) {
      throw new Error(error.message);
    } else {
      throw new Error("OTP request failed. Please try again.");
    }
  }
}

export async function checkExisting(
  prop: string,
  value: string
): Promise<boolean> {
  try {
    const response = await Dmart.check_existing(prop, value);
    return response.attributes.unique;
  } catch (error: any) {
    if (error.response?.data?.error?.message) {
      throw new Error(error.response.data.error.message);
    } else if (error.message) {
      throw new Error(error.message);
    } else {
      throw new Error("Check existing failed. Please try again.");
    }
  }
}

export async function register(
  email: string,
  otp: string,
  password: string,
  confirmPassword: string
) {
  if (password !== confirmPassword) {
    throw new Error("Passwords do not match");
  }

  const request: ActionRequestRecord = {
    resource_type: ResourceType.content,
    shortname: "auto",
    subpath: "/",
    attributes: {
      email: email,
      email_otp: otp,
      password: password,
    },
  };

  try {
    const response = await Dmart.create_user(request);

    if (response.status === "success") {
      await loginBy(email, password);
    } else {
      throw new Error(response.error?.message || "Registration failed");
    }

    return response;
  } catch (error: any) {
    if (error.response?.data?.error?.message) {
      throw new Error(error.response.data.error.message);
    } else if (error.message) {
      throw new Error(error.message);
    } else {
      throw new Error("Registration failed. Please try again.");
    }
  }
}

export async function signout() {
  if (
    typeof localStorage !== "undefined" &&
    JSON.parse(localStorage.getItem(KEY))?.signedin
  ) {
    localStorage.removeItem("rowPerPage");
    user.set(signedout);
    localStorage.removeItem(KEY);
    await Dmart.logout();
  }
}

export function switchLocale(locale: Locale) {
  user.update((user) => {
    user.locale = locale;
    signedout.locale = locale;
    if (typeof localStorage !== "undefined")
      localStorage.setItem(KEY, JSON.stringify(user));
    return user;
  });
}

export async function contactUs(
  name: string,
  email: string,
  message: string,
  subject: string
) {
  try {
    const response = await Dmart.submit(
      "applications",
      "contact",
      "contacts",
      {
        full_name: name,
        email: email,
        message: message,
        subject: subject,
      },
      ResourceType.content
    );
    if (response.status === "success") {
      return `
        <Toast>
          {#snippet icon()}
            <FireOutline class="text-primary-500 bg-primary-100 dark:bg-primary-800 dark:text-primary-200 h-6 w-6" />
          {/snippet}
            Your message has been sent successfully
        </Toast>
      `;
    } else {
      throw new Error(response.error?.message || "Registration failed");
    }
  } catch (error: any) {
    if (error.response?.data?.error?.message) {
      throw new Error(error.response.data.error.message);
    } else if (error.message) {
      throw new Error(error.message);
    } else {
      throw new Error("Sending messgae failed. Please try again.");
    }
  }
}
