# Sha Builder

**A powerful visual page builder for WordPress** — edit HTML, CSS, and JavaScript visually with a live preview. Select elements, edit properties, and save just like Elementor, but with full code control.

Built for developers who want the speed of a visual builder without sacrificing direct code access. Free & open source.

---

## Features

- **Live Preview** — Edit HTML, CSS, and JS in the code panel and see changes instantly in the iframe preview.
- **Visual Element Inspector** — Hover over elements in the preview to inspect them; click to select and edit.
- **CSS Property Editor** — Change colors, typography, spacing, layout, effects and more through an intuitive property panel — no coding required.
- **Interactive States** — Edit `:hover`, `:focus`, and `:active` styles for links and buttons.
- **Attribute Manager** — View, add, edit, and remove HTML attributes on any element.
- **Override System** — Property changes made via the inspector are saved as overrides, keeping your source code clean.
- **Responsive Preview** — Switch between desktop, tablet, and mobile views.
- **Code Editors** — Full HTML, CSS, and JavaScript editors with syntax-aware styling.
- **Undo-Safe** — Your original HTML/CSS/JS stays untouched in the code editors; the inspector layer adds overrides on top.
- **Frontend Rendering** — All builder content renders on the frontend with proper CSS/JS injection.

## Requirements

- WordPress 5.0+
- PHP 7.4+
- A modern browser (Chrome, Firefox, Edge, Safari)

## Installation

1. Download the plugin zip or clone this repository into `/wp-content/plugins/sha-builder/`.
2. Activate **Sha Builder** from the WordPress Plugins screen.
3. Go to **Pages** or **Posts**, hover over any item, and click **Edit with Sha**.
4. You can also use the **Sha Builder** meta box on the post edit screen.

## Usage

### Opening the Builder

- **From the list:** Hover over a page or post title and click the **Edit with Sha** link.
- **From the editor:** In the post edit screen, find the **Sha Builder** meta box in the sidebar and click **Edit with Sha Builder**.

### The Builder Interface

| Area | Description |
|------|-------------|
| **Top Bar** | Logo, page title, device switcher, Render and Save buttons |
| **Left Panel** | Code editors (HTML/CSS/JS), Properties panel, Attributes panel |
| **Right Panel** | Live preview iframe with element inspector |
| **Resize Handle** | Drag to resize the left panel |

### Editing with the Inspector

1. Click **Render** to preview your code.
2. Hover over any element in the preview — an orange dashed border appears.
3. Click the element to select it — the **Properties** tab opens with all editable CSS.
4. Modify values — changes apply live to the preview.
5. Click **Save** to persist everything.

## License

This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! Feel free to open issues and pull requests.

1. Fork the repository.
2. Create a feature branch (`git checkout -b feature/amazing-feature`).
3. Commit your changes (`git commit -m 'Add amazing feature'`).
4. Push to the branch (`git push origin feature/amazing-feature`).
5. Open a Pull Request.

## Credits

Created by [Muhammed Shariq](https://mshariqq.github.io). Built with WordPress, jQuery, and a lot of orange.

---

<p align="center">Made with ❤️ for the WordPress community</p>
