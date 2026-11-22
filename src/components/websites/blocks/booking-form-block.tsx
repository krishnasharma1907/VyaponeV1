"use client";

import React, { useEffect, useRef, useState } from "react";
import type { BlockComponentProps, BookingFormBlockProps } from "./types";
import { getButtonRadiusClass, getCardRadiusClass } from "./utils";
import { CalendarIcon, CheckCircleIcon } from "./icons";

export function BookingFormBlock({
  id,
  props,
  context,
  className = "",
}: BlockComponentProps<BookingFormBlockProps>) {
  const theme = context?.theme;
  const catalogue = context?.catalogueItems || [];
  const buttonRadius = getButtonRadiusClass(theme?.radii);
  const cardRadius = getCardRadiusClass(theme?.radii);

  // Module operational status check (VO-046)
  const appointmentsMod = context?.modules?.appointments;
  const isOperational = appointmentsMod ? appointmentsMod.status === "operational" : true;
  const isComingSoon = appointmentsMod ? appointmentsMod.status === "coming_soon" : false;
  const isInformational = appointmentsMod ? appointmentsMod.status === "informational" : false;

  // Available services from catalogue or fallback
  const availableServices =
    props.serviceIds && props.serviceIds.length > 0
      ? catalogue.filter((item) => props.serviceIds!.includes(item.id))
      : catalogue.filter(
          (item) =>
            item.category?.toLowerCase().includes("service") ||
            item.category?.toLowerCase().includes("appointment") ||
            catalogue.length < 10,
        );

  const [serviceId, setServiceId] = useState<string>(availableServices[0]?.id || "");
  const [name, setName] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [date, setDate] = useState<string>("");
  const [timeSlot, setTimeSlot] = useState<string>("morning");
  const [notes, setNotes] = useState<string>("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const submitTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (submitTimerRef.current) {
        clearTimeout(submitTimerRef.current);
      }
    };
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    if (!name.trim()) {
      setErrorMessage("Please enter your name.");
      return;
    }

    if (props.requirePhone !== false) {
      const cleanPhone = phone.replace(/[^0-9]/g, "");
      if (cleanPhone.length < 10) {
        setErrorMessage("Please enter a valid 10-digit mobile number.");
        return;
      }
    }

    if (!date) {
      setErrorMessage("Please select your preferred date.");
      return;
    }

    setStatus("submitting");

    // Action callback or simulated submission
    if (context?.onAction) {
      context.onAction(isOperational ? "booking_submitted" : "appointment_enquiry_submitted", {
        serviceId,
        name,
        phone,
        date,
        timeSlot,
        notes,
        isOperational,
      });
    }

    if (submitTimerRef.current) {
      clearTimeout(submitTimerRef.current);
    }

    submitTimerRef.current = setTimeout(() => {
      setStatus("success");
    }, 400);
  };

  return (
    <section
      id={id}
      data-block-type="booking_form"
      aria-labelledby={`${id}-title`}
      className={`w-full py-12 md:py-16 px-4 sm:px-6 lg:px-8 ${className}`.trim()}
      style={{
        backgroundColor: theme?.colors.background || "#FFFFFF",
        color: theme?.colors.text || "#0F172A",
      }}
    >
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800">
            <CalendarIcon size={14} />
            <span>
              {isComingSoon
                ? "Appointments Coming Soon"
                : isInformational
                  ? "Appointment Enquiry"
                  : "Online Booking"}
            </span>
          </div>
          <h2
            id={`${id}-title`}
            className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight"
            style={{ fontFamily: theme?.fonts.heading || "Inter, sans-serif" }}
          >
            {props.title || "Book an Appointment"}
          </h2>
          <p className="text-sm sm:text-base text-slate-600">
            {isOperational
              ? "Reserve your slot in seconds. We confirm all appointments promptly."
              : "Submit your appointment request. We will contact you directly to confirm availability."}
          </p>
        </div>

        {/* Informational Mode Notice */}
        {(isInformational || isComingSoon) && (
          <div
            className={`p-4 bg-sky-50 border border-sky-200 text-sky-900 text-xs sm:text-sm space-y-1 ${cardRadius}`}
          >
            <p className="font-semibold">
              {isComingSoon
                ? "Note: Automated appointment scheduling is coming soon."
                : "Note: Direct appointment confirmation via store consultation."}
            </p>
            <p className="text-sky-800/90 text-xs">
              Requests submitted here are received as enquiries and confirmed directly via WhatsApp
              or phone.
            </p>
          </div>
        )}

        {props.notice && (
          <div
            className={`p-4 bg-amber-50/80 border border-amber-200/80 text-amber-900 text-xs sm:text-sm ${cardRadius}`}
          >
            <span className="font-semibold">Notice: </span>
            {props.notice}
          </div>
        )}

        {status === "success" ? (
          <div
            className={`p-6 sm:p-8 bg-emerald-50 border border-emerald-200 text-center space-y-3 ${cardRadius}`}
          >
            <CheckCircleIcon size={40} className="mx-auto text-emerald-600" />
            <h3 className="text-lg font-bold text-emerald-950">Booking Request Received!</h3>
            <p className="text-sm text-emerald-800">
              Thank you, {name}. We have received your appointment request for {date} ({timeSlot}).
              We will contact you via phone/WhatsApp to confirm.
            </p>
            <button
              type="button"
              className={`mt-4 px-4 py-2 text-xs font-semibold text-emerald-900 bg-emerald-200/60 hover:bg-emerald-200 transition-colors ${buttonRadius}`}
              onClick={() => {
                setStatus("idle");
                setDate("");
                setName("");
                setPhone("");
                setNotes("");
              }}
            >
              Book Another Appointment
            </button>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className={`p-6 sm:p-8 bg-white border border-slate-200/90 shadow-sm space-y-5 ${cardRadius}`}
          >
            {errorMessage && (
              <div
                role="alert"
                className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium rounded-md"
              >
                {errorMessage}
              </div>
            )}

            {/* Service Selection */}
            {availableServices.length > 0 && (
              <div className="space-y-1.5">
                <label
                  htmlFor={`${id}-service`}
                  className="block text-xs font-semibold text-slate-700"
                >
                  Select Service
                </label>
                <select
                  id={`${id}-service`}
                  value={serviceId}
                  onChange={(e) => setServiceId(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-600"
                >
                  {availableServices.map((svc) => (
                    <option key={svc.id} value={svc.id}>
                      {svc.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Customer Name */}
            <div className="space-y-1.5">
              <label htmlFor={`${id}-name`} className="block text-xs font-semibold text-slate-700">
                Your Full Name <span className="text-rose-500">*</span>
              </label>
              <input
                id={`${id}-name`}
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Ramesh Kumar"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            {/* Customer Phone */}
            {props.requirePhone !== false && (
              <div className="space-y-1.5">
                <label
                  htmlFor={`${id}-phone`}
                  className="block text-xs font-semibold text-slate-700"
                >
                  Mobile Number (WhatsApp) <span className="text-rose-500">*</span>
                </label>
                <div className="flex rounded-md shadow-xs">
                  <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-slate-300 bg-slate-50 text-slate-500 text-sm">
                    +91
                  </span>
                  <input
                    id={`${id}-phone`}
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="9876543210"
                    maxLength={12}
                    className="flex-1 px-3 py-2 text-sm bg-white border border-slate-300 rounded-r-md focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
              </div>
            )}

            {/* Date and Time Slot */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label
                  htmlFor={`${id}-date`}
                  className="block text-xs font-semibold text-slate-700"
                >
                  Preferred Date <span className="text-rose-500">*</span>
                </label>
                <input
                  id={`${id}-date`}
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor={`${id}-slot`}
                  className="block text-xs font-semibold text-slate-700"
                >
                  Preferred Time Slot
                </label>
                <select
                  id={`${id}-slot`}
                  value={timeSlot}
                  onChange={(e) => setTimeSlot(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-600"
                >
                  <option value="morning">Morning (9:00 AM - 12:00 PM)</option>
                  <option value="afternoon">Afternoon (12:00 PM - 4:00 PM)</option>
                  <option value="evening">Evening (4:00 PM - 8:00 PM)</option>
                </select>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <label htmlFor={`${id}-notes`} className="block text-xs font-semibold text-slate-700">
                Additional Instructions (Optional)
              </label>
              <textarea
                id={`${id}-notes`}
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any special requests or details..."
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <button
              type="submit"
              disabled={status === "submitting"}
              className={`w-full py-3 px-4 text-sm font-semibold text-white shadow-xs transition-opacity hover:opacity-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${buttonRadius}`}
              style={{ backgroundColor: theme?.colors.primary || "#0B6E4F" }}
            >
              {status === "submitting"
                ? "Submitting Request..."
                : isOperational
                  ? "Request Appointment"
                  : "Submit Appointment Enquiry"}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
