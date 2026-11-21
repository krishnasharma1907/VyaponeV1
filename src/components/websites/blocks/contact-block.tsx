"use client";

import React, { useState } from "react";
import type { BlockComponentProps, ContactBlockProps } from "./types";
import { PhoneIcon, WhatsAppIcon, MailIcon, CheckCircleIcon } from "./icons";
import { getButtonRadiusClass, getCardRadiusClass } from "./utils";

export function ContactBlock({
  id,
  props,
  context,
  className = "",
}: BlockComponentProps<ContactBlockProps>) {
  const theme = context?.theme;
  const business = context?.business;
  const buttonRadius = getButtonRadiusClass(theme?.radii);
  const cardRadius = getCardRadiusClass(theme?.radii);

  const [name, setName] = useState<string>("");
  const [contact, setContact] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success">("idle");
  const [error, setError] = useState<string>("");

  const phoneNum = business?.phone || "+91 98765 43210";
  const whatsappNum = business?.whatsappNumber || business?.phone || "9876543210";
  const emailAddr = business?.email || "contact@vyapone.com";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Please enter your name.");
      return;
    }
    if (!contact.trim()) {
      setError("Please provide your phone number or email.");
      return;
    }
    if (!message.trim()) {
      setError("Please write your message.");
      return;
    }

    setStatus("submitting");
    if (context?.onAction) {
      context.onAction("contact_message_sent", { name, contact, message });
    }

    setTimeout(() => {
      setStatus("success");
    }, 400);
  };

  return (
    <section
      id={id}
      data-block-type="contact"
      aria-labelledby={`${id}-title`}
      className={`w-full py-12 md:py-16 px-4 sm:px-6 lg:px-8 ${className}`.trim()}
      style={{
        backgroundColor: theme?.colors.surface || "#F8FAFC",
        color: theme?.colors.text || "#0F172A",
      }}
    >
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <h2
            id={`${id}-title`}
            className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight"
            style={{ fontFamily: theme?.fonts.heading || "Inter, sans-serif" }}
          >
            {props.title || "Get in Touch"}
          </h2>
          <p className="text-sm sm:text-base text-slate-600">
            Have questions about our products, catering, or bulk orders? We are here to help.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          {/* Quick Direct Actions */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Direct Communication</h3>
            <p className="text-sm text-slate-600">
              Reach out through your preferred channel for instant assistance.
            </p>

            <div className="space-y-3 pt-2">
              {props.showPhone !== false && (
                <a
                  href={`tel:${phoneNum.replace(/[^0-9+]/g, "")}`}
                  className={`flex items-center gap-3 p-4 bg-white border border-slate-200/90 shadow-2xs hover:border-slate-300 transition-colors ${cardRadius}`}
                >
                  <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-700">
                    <PhoneIcon size={20} />
                  </div>
                  <div>
                    <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Call Us
                    </span>
                    <span className="text-sm sm:text-base font-bold text-slate-900">
                      {phoneNum}
                    </span>
                  </div>
                </a>
              )}

              {props.showWhatsapp !== false && (
                <a
                  href={`https://wa.me/${whatsappNum.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(
                    `Hello ${business?.name || ""}, I have an enquiry.`,
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center gap-3 p-4 bg-white border border-slate-200/90 shadow-2xs hover:border-slate-300 transition-colors ${cardRadius}`}
                >
                  <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-700">
                    <WhatsAppIcon size={20} />
                  </div>
                  <div>
                    <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      WhatsApp Chat
                    </span>
                    <span className="text-sm sm:text-base font-bold text-slate-900">
                      Chat with Store
                    </span>
                  </div>
                </a>
              )}

              {props.showEmail !== false && (
                <a
                  href={`mailto:${emailAddr}`}
                  className={`flex items-center gap-3 p-4 bg-white border border-slate-200/90 shadow-2xs hover:border-slate-300 transition-colors ${cardRadius}`}
                >
                  <div className="p-2.5 rounded-lg bg-slate-100 text-slate-700">
                    <MailIcon size={20} />
                  </div>
                  <div>
                    <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Email Us
                    </span>
                    <span className="text-sm sm:text-base font-bold text-slate-900">
                      {emailAddr}
                    </span>
                  </div>
                </a>
              )}
            </div>
          </div>

          {/* Contact Inquiry Form */}
          {props.enableForm !== false && (
            <div
              className={`p-6 sm:p-8 bg-white border border-slate-200/90 shadow-xs space-y-4 ${cardRadius}`}
            >
              <h3 className="text-lg font-bold text-slate-900">Send an Enquiry</h3>

              {status === "success" ? (
                <div className="py-8 text-center space-y-3">
                  <CheckCircleIcon size={36} className="mx-auto text-emerald-600" />
                  <h4 className="text-base font-bold text-slate-900">Message Sent Successfully!</h4>
                  <p className="text-xs sm:text-sm text-slate-600">
                    Thank you, {name}. We will get back to you shortly.
                  </p>
                  <button
                    type="button"
                    className={`mt-2 px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 ${buttonRadius}`}
                    onClick={() => {
                      setStatus("idle");
                      setName("");
                      setContact("");
                      setMessage("");
                    }}
                  >
                    Send Another Message
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  {error && (
                    <div
                      role="alert"
                      className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium rounded-md"
                    >
                      {error}
                    </div>
                  )}

                  <div className="space-y-1">
                    <label
                      htmlFor={`${id}-name`}
                      className="block text-xs font-semibold text-slate-700"
                    >
                      Your Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id={`${id}-name`}
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Priya Sharma"
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    />
                  </div>

                  <div className="space-y-1">
                    <label
                      htmlFor={`${id}-contact`}
                      className="block text-xs font-semibold text-slate-700"
                    >
                      Phone Number or Email <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id={`${id}-contact`}
                      type="text"
                      required
                      value={contact}
                      onChange={(e) => setContact(e.target.value)}
                      placeholder="e.g. 9876543210 or name@example.com"
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    />
                  </div>

                  <div className="space-y-1">
                    <label
                      htmlFor={`${id}-message`}
                      className="block text-xs font-semibold text-slate-700"
                    >
                      Message <span className="text-rose-500">*</span>
                    </label>
                    <textarea
                      id={`${id}-message`}
                      rows={3}
                      required
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="How can we help you?"
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={status === "submitting"}
                    className={`w-full py-2.5 px-4 text-sm font-semibold text-white shadow-xs transition-opacity hover:opacity-95 ${buttonRadius}`}
                    style={{ backgroundColor: theme?.colors.primary || "#0B6E4F" }}
                  >
                    {status === "submitting" ? "Sending..." : "Submit Message"}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
