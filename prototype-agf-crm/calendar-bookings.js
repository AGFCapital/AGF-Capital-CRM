function bookingCreatedAt(booking) {
  const value = booking?.provider_created_at || booking?.created_at;
  const timestamp = value ? new Date(value).getTime() : Number.NEGATIVE_INFINITY;
  return Number.isFinite(timestamp) ? timestamp : Number.NEGATIVE_INFINITY;
}

export function chooseLatestActiveBooking(bookings = []) {
  return bookings
    .filter((booking) =>
      booking?.status === "booked"
      && booking?.match_status !== "unmatched"
      && booking?.starts_at
    )
    .sort((left, right) => bookingCreatedAt(right) - bookingCreatedAt(left))[0] || null;
}
