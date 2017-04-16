require 'rails/generators'
require 'yaml'

class BinnacleGenerator < Rails::Generators::Base
  source_root File.expand_path('../templates', __FILE__)

  gem "binnacle"

  desc "Generates Binnacle Initialization Artifacts: initializer, firebase cloud messaging (fcm) artifacts (optional)"

  class_option :firebase, type: :boolean, default: false, description: "Generated artifacts for Firebase Cloud Messaging"

  def create_initializer_file

    initializer "binnacle.rb" do
      YAML::load(<<-EOM)
      |
      # #{'=' * 78}
      # Binnacle Configuration
      # #{'=' * 78}
      # Available parameters (preferably configure via ENV):
      # #{'=' * 78}
      # - url:         The Binnacle Endpoint URL (BINNACLE_URL)
      # - logging_channel: The application logger Binnacle Channel (BINNACLE_APP_LOG_CHANNEL)
      # - error_channel:   The application error Binnacle Channel (BINNACLE_APP_ERR_CHANNEL)
      # - api_key:     An approved publisher API key for the App (BINNACLE_API_KEY)
      # - api_secret:  The API secret for the given API key (BINNACLE_API_SECRET)
      # - intercept_rails_logging: Redirect rails logging to logging_channel (BINNACLE_RAILS_LOG)
      # - report_exceptions: Trap exceptions are log them to error_channel (BINNACLE_REPORT_EXCEPTIONS)
      # #{'=' * 78}
      Binnacle.configure do |config|
        config.intercept_rails_logging = true
        config.report_exceptions = true
      end
      EOM
    end
  end

  def create_web_app_manifest_for_firebase
    if options.firebase?
      create_file "app/assets/javascripts/manifest.json", { gcm_sender_id: "103953800507" }.to_json

      app_layout = find_application_layout
      manifest_include = ActionController::Base.helpers.tag(:link, rel: 'manifest', href: "/manifest.json")

      if app_layout
        inject_into_file app_layout, before: "</head>\n" do
          manifest_include
        end
      else
        warn " #{'warning:'.red} couldn't find application layout. add manifest declaration manually to your layout's <head> section:"
        warn "      #{manifest_include}"
      end

      append_to_file "config/initializers/assets.rb", "Rails.application.config.assets.precompile += %w( manifest.json firebase-messaging-sw.js )\n"
      inject_into_file "config/application.rb", %[    config.assets.paths << Rails.root.join("app", "assets", "service_workers")\n], :after => "Rails::Application\n"

      template "firebase-messaging-sw.js.erb", "app/assets/service_workers/firebase-messaging-sw.js.erb"

      routes = <<-ROUTES
  get 'manifest.json', to: redirect(ActionController::Base.helpers.asset_path('manifest.json'))
  get 'firebase-messaging-sw.js', to: -> (env) do
    [200, { 'Content-Type' => 'application/javascript' }, [Rails.application.assets['firebase-messaging-sw.js'].to_s]]
  end
       ROUTES

      inject_into_file "config/routes.rb", routes, :before => /^end/
    end
  end

  private

  def find_application_layout
    layouts = %w[html.erb html.haml html.slim erb haml slim].map do |extension|
      "app/views/layouts/application.#{extension}"
    end.find { |layout| File.exist?(layout) }
  end
end
