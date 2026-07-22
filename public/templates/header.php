<?php
if (!defined('ABSPATH')) {
    exit;
}

$frontend  = sha_builder()->get_frontend();
$header_id = $frontend->get_effective_header_id();
$data = array();

if ($header_id) {
    $data = $frontend->get_data($header_id);
}

$html = '';
$css  = '';
$js   = '';
if ($data && !empty($data['sections'])) {
    foreach ($data['sections'] as $sec) {
        if (is_array($sec)) {
            $html .= (isset($sec['html']) ? $sec['html'] : '') . "\n";
            $css  .= (isset($sec['css'])  ? $sec['css']  : '') . "\n";
            $js   .= (isset($sec['js'])   ? $sec['js']   : '') . "\n";
        }
    }
    if (!empty($data['global_css'])) $css .= "\n" . $data['global_css'];
    if (!empty($data['global_js']))  $js  .= "\n" . $data['global_js'];
}
?>
<!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
    <meta charset="<?php bloginfo('charset'); ?>">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <?php wp_head(); ?>
    <?php if (!empty($css)) : ?>
    <style id="sha-builder-header-css">
        <?php echo wp_strip_all_tags($css); ?>
    </style>
    <?php endif; ?>
</head>
<body <?php body_class(); ?>>
<?php wp_body_open(); ?>
<?php
if (!empty($html)) {
    $executor = Sha_Builder_PHP_Executor::instance();
    $rendered = $executor->execute_html($header_id, '', $html);
    echo '<div id="sha-builder-header" class="sha-builder-header">' . $rendered . '</div>'; // WPCS: XSS ok - rendered builder content
}
