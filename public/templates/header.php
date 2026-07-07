<?php
if (!defined('ABSPATH')) {
    exit;
}

$header_id = get_option('sha_builder_active_header', 0);
$data      = array();

if ($header_id) {
    $data = get_post_meta($header_id, '_sha_builder_data', true);
}

if (!is_array($data)) {
    $data = array('html' => '', 'css' => '', 'js' => '');
}
?>
<!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
    <meta charset="<?php bloginfo('charset'); ?>">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <?php wp_head(); ?>
    <?php if (!empty($data['css'])) : ?>
    <style id="sha-builder-header-css">
        <?php echo $data['css']; ?>
    </style>
    <?php endif; ?>
</head>
<body <?php body_class(); ?>>
<?php wp_body_open(); ?>
<?php
if (!empty($data['html'])) {
    $executor = Sha_Builder_PHP_Executor::instance();
    $html = $executor->execute_html($header_id, $data['html']);
    echo '<div id="sha-builder-header" class="sha-builder-header">' . $html . '</div>';
}
