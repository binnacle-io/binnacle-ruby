if defined?(Patron)
  require 'uri'

  module Patron
    class Session
      alias_method :orig_request, :request
      def request(action_name, url, headers, options = {})
        log_enabled = Binnacle::HttpLogger.allow?(url)

        bm = Benchmark.realtime do
          @response = orig_request(action_name, url, headers, options)
        end

        if log_enabled
          headers = @response.headers
          uri = URI(url)
          url_without_query = "#{uri.scheme}://#{uri.host}:#{uri.port}#{uri.path}"

          Binnacle::HttpLogger.signal(url_without_query, action_name, uri.host, uri.port, uri.path, uri.query, @response.status, bm, headers, @response.body, headers['Content-Encoding'], headers['Content-Type'], options[:data])
        end
      end
    end
  end
end
