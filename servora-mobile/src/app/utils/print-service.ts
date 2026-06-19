import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

export async function printReport(
  title: string,
  companyName: string,
  content: string
) {
  try {
    const html = `
      <html>
        <body>
          <h1>${companyName}</h1>
          <h2>${title}</h2>
          ${content}
        </body>
      </html>
    `;

    const file =
      await Print.printToFileAsync({
        html,
      });

    await Sharing.shareAsync(
      file.uri
    );
  } catch (error) {
    console.log(error);
  }
}
export default {};
