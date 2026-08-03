<?php
if (!defined('ABSPATH')) {
    exit;
}

$frontend  = sha_builder()->get_frontend();
$footer_id = $frontend->get_effective_footer_id();
$data = array();

if ($footer_id) {
    $data = $frontend->get_data($footer_id);
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

$executor = Sha_Builder_PHP_Executor::instance();

if (!empty($html)) {
    $rendered = $executor->execute_html($footer_id, '', $html);
    echo '<div id="sha-builder-footer" class="sha-builder-footer">' . $rendered . '</div>'; // WPCS: XSS ok - rendered builder content
}

if (!empty($js)) :
?>
<script id="sha-builder-footer-js">
// <![CDATA[
<?php echo "\n" . $js . "\n"; ?>
// ]]>
</script>
<?php endif; ?>
<?php wp_footer(); ?>
</body>
</html>
