unless ENV['RAILS_ENV'] == 'test'
  if defined?(::HTTP::Client) and defined?(::HTTP::Connection)
    require 'uri'

    module ::HTTP
      class Client
        alias_method(:orig_make_request, :make_request) unless method_defined?(:orig_make_request)

        def make_request(req, options)
          log_enabled = Binnacle::HttpLogger.allow?(req.uri)

          bm = Benchmark.realtime do
            @response = orig_make_request(req, options)
          end

          if log_enabled
            headers = @response.headers.to_h
            content_type = headers['Content-Type']
            uri = URI(req.uri)
            url_without_query = "#{uri.scheme}://#{uri.host}:#{uri.port}#{uri.path}"

            Binnacle::HttpLogger.signal(url_without_query, req.verb, uri.host, uri.port, uri.path, uri.query, @response.code, bm, headers, @response.body, nil, content_type, req.body)
          end

          @response
        end
      end
    end
  end
end

#
# Adapt the adapter to allow for testing..
#
if ENV['RAILS_ENV'] == 'test' #defined?(Webmock) &&
  require 'webmock'
  module HTTP
    class Client
      alias_method :orig_perform, :perform

      def perform(request, options)
        return orig_perform(request, options) unless webmock_enabled?

        log_enabled = Binnacle::HttpLogger.allow?(request.uri)

        bm = Benchmark.realtime do
          @response = WebMockPerform.new(request) { orig_perform(request, options) }.exec
        end

        if log_enabled
          headers = @response.headers.to_h
          uri = URI(request.uri)
          url_without_query = "#{uri.scheme}://#{uri.host}:#{uri.port}#{uri.path}"

          Binnacle::HttpLogger.signal(url_without_query, request.verb, uri.host, uri.port, uri.path, uri.query, @response.code, bm, headers, @response.body, headers['Content-Encoding'], headers['Content-Type'], request.body)
        end

        @response
      end

    end
  end
end
