require 'spec_helper'

describe Binnacle::HttpLogger do
  before do
    reset_env
    Binnacle.configure do |config|
      config.endpoint = 'localhost'
      config.api_key = 'vceth4xcwqfoowpz2esi'
      config.api_secret = '1grttyb8ozbe9axt88ji'
      config.logging_ctx = 'icoc0tnol3obe8pas207'
      config.encrypted = false
      config.asynch_logging = false
    end
  end

  let(:host) { 'localhost' }
  let(:port) { 9292 }
  let(:path) { "/index.html" }
  let(:headers) { { "accept" => "*/*", "foo" => "bar" } }
  let(:data) { {'foo' => 'bar', 'bar' => 'foo'} }
  let(:params) { {'foo' => 'bar:form-data', 'bar' => 'foo'} }

  ADAPTERS = [
    NetHTTPAdapter,
    OpenUriAdapter,
    HTTPClientAdapter,
    HTTPartyAdapter,
    FaradayAdapter,
    ExconAdapter,
    ENV['SERVE_TEST_ASSETS'] == 'true' ? EthonAdapter : nil,
    TyphoeusAdapter,
    PatronAdapter,
    HTTPAdapter 
  ].compact

  ADAPTERS.each do |adapter_class|
    context adapter_class, adapter: adapter_class.to_s do
      let(:adapter) { adapter_class.new(host, port, path, headers, data, params) }

      connection_test_method = adapter_class.is_libcurl? ? :to_not : :to

      if adapter_class.method_defined? :send_get_request
        it "should log GET requests", :vcr do
          res = adapter.send_get_request

          expect(a_request(:get, 'http://localhost:8080/api/endpoints'))
          expect(a_request(:get, 'http://localhost:9292/index.html'))

          expect(
            a_request(:post, "http://localhost:8080/api/events/icoc0tnol3obe8pas207").
              with do |request|
                body_as_json = JSON.parse(request.body)
                body_as_json["contextId"] == "icoc0tnol3obe8pas207" &&
                body_as_json["sessionId"] == "" &&
                body_as_json["clientId"] == "" &&
                body_as_json["eventName"] == "GET http://localhost:9292/index.html" &&
                body_as_json["logLevel"] == "log" &&
                body_as_json["tags"] == [] &&
                body_as_json["json"]["url"] == "http://localhost:9292/index.html" &&
                body_as_json["json"]["method"] == "GET" &&
                body_as_json["json"]["host"] == "localhost" &&
                body_as_json["json"]["port"] == 9292 &&
                body_as_json["json"]["path"] == "/index.html" &&
                body_as_json["json"]["query"] == "foo=bar&bar=foo" &&
                body_as_json["json"]["format"] == "text/html" &&
                body_as_json["json"]["status"] == "200" &&
                body_as_json["json"]["duration"] > 0.0 &&
                body_as_json["json"]["body"] == "<html>\n  <head>\n    <title>Test Page</title>\n  </head>\n  <body>\n    <h1>This is the test page.</h1>\n  </body>\n</html>" &&
                body_as_json["json"]["data"] == ""
                body_as_json["json"]["message"] =~ /GET http:\/\/localhost:9292\/index.html AS text\/html \(duration:(.*)/
              end
          ).to(have_been_made.times(1))
        end
      end
    end
  end
end
