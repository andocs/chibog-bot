const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const axios = require("axios");
const { appendPlaceToSheet } = require("../../sheets");

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

module.exports = {
  data: new SlashCommandBuilder()
    .setName("place")
    .setDescription("Add a restaurant or shop to the food list")
    .addStringOption((option) =>
      option
        .setName("query")
        .setDescription("Google Maps link or name of the place")
        .setRequired(true)
    ),

  async execute(interaction) {
    await interaction.deferReply();

    const input = interaction.options.getString("query");
    let placeId;

    try {
      // 1. Search for the place (by name, address, or pasted link text)
      const searchRes = await axios.post(
        "https://places.googleapis.com/v1/places:searchText",
        { textQuery: input },
        {
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": GOOGLE_API_KEY,
            "X-Goog-FieldMask": "places.id",
          },
        },
        {
          parameters: {
            regionCode: "PH",
          },
        }
      );

      if (!searchRes.data.places || !searchRes.data.places.length) {
        return interaction.editReply("❌ No place found for that query.");
      }

      placeId = searchRes.data.places[0].id;

      // 2. Get details of the place
      const detailsRes = await axios.get(
        `https://places.googleapis.com/v1/places/${placeId}`,
        {
          headers: {
            "X-Goog-Api-Key": GOOGLE_API_KEY,
            "X-Goog-FieldMask":
              "displayName,nationalPhoneNumber,formattedAddress,rating,googleMapsUri,websiteUri,primaryTypeDisplayName,userRatingCount,priceLevel,priceRange",
          },
        },
        {
          parameters: {
            regionCode: "PH",
          },
        }
      );

      const place = detailsRes.data;

      console.log(place);

      if (!place?.displayName?.text) {
        return interaction.editReply("❌ Failed to fetch place details.");
      }

      // 3. Save to Google Sheets
      await appendPlaceToSheet([
        [
          place.displayName.text,
          place.formattedAddress || "N/A",
          place.primaryTypeDisplayName.text || "N/A",
          place.rating || "N/A",
          place.priceLevel === "PRICE_LEVEL_INEXPENSIVE"
            ? "$"
            : place.priceLevel === "PRICE_LEVEL_MODERATE"
            ? "$$"
            : place.priceLevel === "PRICE_LEVEL_EXPENSIVE"
            ? "$$$"
            : place.priceLevel === "PRICE_LEVEL_VERY_EXPENSIVE"
            ? "$$$$"
            : "N/A",
          `P${place.priceRange.startPrice.units} - P${place.priceRange.endPrice.units}` ||
            "N/A",
          place.nationalPhoneNumber || "N/A",
          place.googleMapsUri || "N/A",
          place.websiteUri || "N/A",
          interaction.user.username,
          new Date().toDateString(),
        ],
      ]);

      // 4. Build Discord embed
      const embed = new EmbedBuilder()
        .setTitle(place.displayName.text)
        .setDescription(`📍 [View on Google Maps](${place.googleMapsUri})`)
        .addFields(
          {
            name: "Category",
            value: place.primaryTypeDisplayName?.text || "N/A",
            inline: true,
          },
          {
            name: "Rating",
            value: place.rating?.toString() || "N/A",
            inline: true,
          },
          {
            name: "Reviews",
            value: place.userRatingCount?.toString() || "N/A",
            inline: true,
          },
          { name: "Address", value: place.formattedAddress || "N/A" },
          { name: "Website", value: place.websiteUri || "N/A" },
          { name: "Phone", value: place.nationalPhoneNumber || "N/A" },
          {
            name: "Price Level",
            value:
              place.priceLevel === "PRICE_LEVEL_INEXPENSIVE"
                ? "₱ (Inexpensive)"
                : place.priceLevel === "PRICE_LEVEL_MODERATE"
                ? "₱₱ (Moderate)"
                : place.priceLevel === "PRICE_LEVEL_EXPENSIVE"
                ? "₱₱₱ (Expensive)"
                : place.priceLevel === "PRICE_LEVEL_VERY_EXPENSIVE"
                ? "₱₱₱₱ (Very Expensive)"
                : "N/A",
            inline: true,
          },
          {
            name: "Price Range",
            value: place.priceRange
              ? `₱${place.priceRange.startPrice.units || 0} - ₱${
                  place.priceRange.endPrice.units || 0
                }`
              : "N/A",
            inline: true,
          }
        )
        .addFields({
          name: "📄 Sheet Link",
          value:
            "[View All Places](https://docs.google.com/spreadsheets/d/1P8rGecpbjEOOjHAhBIZygOwEtjK00on9qrEnoCmlYsE/edit?usp=sharing)",
        })
        .setColor(0xffa500);

      await interaction.editReply({
        content: "📝 Place added to Google Sheet",
        embeds: [embed],
      });
    } catch (error) {
      console.log(error);

      console.error(error.response?.data || error.message);
      await interaction.editReply(
        "❌ An error occurred while fetching place info."
      );
    }
  },
};
